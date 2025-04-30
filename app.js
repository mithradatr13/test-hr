const express = require('express');
const mqtt = require('mqtt');
const amqp = require('amqplib');
const crypto = require('crypto');
const mongoose = require('mongoose');
const app = express();
const Device = require('./models/device');
const Notification = require('./models/notification');
require('dotenv').config();
const dbConnectionString = process.env.DB_CONNECTION_STRING;
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
const PORT = 3000;
mongoose.connect(dbConnectionString, { useNewUrlParser: true, useUnifiedTopology: true });
const mqttClient = mqtt.connect(process.env.MQTT_SERVER);
mqttClient.on('connect', () => {
    mqttClient.subscribe(process.env.MQTT_TOPIC);
});
mqttClient.on('message', (topic, message) => {
    const mqttData = JSON.parse(message.toString());
    const { Temp_Value, Humi_Value } = mqttData;
    const message_time = new Date();
    amqp.connect(process.env.RABBITMQ_HOST).then((connection) => {
        return connection.createChannel();
    }).then((channel) => {

        const md5Hash = crypto.createHash('md5').update((Temp_Value + Humi_Value).toString()).digest('hex');
        const data = {
            Temp_Value: Temp_Value,
            Humi_Value: Humi_Value,
            lastSaved: message_time,
            Serial: md5Hash,
        };
        channel.assertQueue(process.env.RABBITMQ_TOPIC_DEVICE, { durable: false });
        channel.assertQueue(process.env.RABBITMQ_TOPIC_NOTIF, { durable: false });
        channel.sendToQueue(process.env.RABBITMQ_TOPIC_DEVICE, Buffer.from(JSON.stringify(data)));
        channel.sendToQueue(process.env.RABBITMQ_TOPIC_NOTIF, Buffer.from(JSON.stringify(data)));
        // console.log('Message sent to RabbitMQ queue');
    }).catch((error) => {
        console.error('Error connecting to RabbitMQ:', error);
    });
});
amqp.connect('amqp://localhost').then((connection) => {
    return connection.createChannel();
}).then((channel) => {
    channel.assertQueue(process.env.RABBITMQ_TOPIC_DEVICE, { durable: false });
    channel.assertQueue(process.env.RABBITMQ_TOPIC_NOTIF, { durable: false });
    channel.consume(process.env.RABBITMQ_TOPIC_DEVICE, (msg) => {
        if (msg !== null) {
            const data = JSON.parse(msg.content.toString());
            const { Temp_Value, Humi_Value, lastSaved, md5Hash } = data;
            const tempCheckpoints = { min: process.env.TMP_VAL_MIN, max: process.env.TMP_VAL_MAX }; // Sample range for Temp_Value
            const humiCheckpoints = { min: process.env.HUMI_VAL_MIN, max: process.env.HUMI_VAL_MAX };
            const deviceData = {
                serialNumber: md5Hash,
                Temp_Value,
                Humi_Value,
                lastSaved,
                checkpoints: {
                    Temp_Value: tempCheckpoints,
                    Humi_Value: humiCheckpoints
                }
            };

            // const foundDevice = Device.findOne({ md5Hash });
            // if (!foundDevice) {
                const device = new Device(deviceData);
                device.save()
                // .then(() => {
                //     console.log('Data saved to MongoDB');
                // }).catch((err) => {
                //     console.error('Error saving data to MongoDB:', err);
                // });
            // }


            channel.ack(msg);
        }
    });


    channel.consume(process.env.RABBITMQ_TOPIC_NOTIF, async (msg) => {
        if (msg !== null) {
            const data = JSON.parse(msg.content.toString());
            const { Temp_Value, Humi_Value, lastSaved, md5Hash } = data;
            const tempCheckpoints = { min: process.env.TMP_VAL_MIN, max: process.env.TMP_VAL_MAX }; // Sample range for Temp_Value
            const humiCheckpoints = { min: process.env.HUMI_VAL_MIN, max: process.env.HUMI_VAL_MAX };

            const serialNumber = md5Hash
            const device = await Device.findOne({ serialNumber });
            if (!device) {
                console.log("device by this serial not found")
            } else {
                if (Temp_Value >= tempCheckpoints.min || Temp_Value <= tempCheckpoints.max ||
                    Humi_Value >= humiCheckpoints.min || Humi_Value <= humiCheckpoints.max) {
                        const notificationData = {
                        deviceId: device._id,
                        parameter: 'Temperature and Humidity',
                        value: "serialNumber",
                        timestamp: lastSaved,
                    };
                    const notification = new Notification(notificationData);
                    await  notification.save()
                    // .then(() => {
                    //     console.log('Notification saved to MongoDB');
                    // }).catch((err) => {
                    //     console.error('Error saving notification to MongoDB:', err);
                    // });
                    // channel.sendToQueue(process.env.RABBITMQ_TOPIC_NOTIF, Buffer.from(JSON.stringify(notificationData)));
                }
            }
            channel.ack(msg);
        }
    });

}).catch((error) => {
    console.error('Error connecting to RabbitMQ:', error);
});



app.get('/devices', async (req, res) => {
    try {
        const devices = await Device.find().limit(10);
        res.json(devices);
    } catch (err) {
        console.error(err);
        return res.status(500).send('Error fetching devices');
    }
});

app.get('/notifications', async (req, res) => {
    try {
        const notifs = await Notification.find().limit(10);
        res.json(notifs);
    } catch (err) {
        console.error(err);
        return res.status(500).send('Error fetching notifs');
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});