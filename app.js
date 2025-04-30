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
const secretKey = process.env.SECRET_KEY;


console.log(dbConnectionString)
const PORT = 3000;
mongoose.connect('mongodb://localhost:27017/mydatabase', { useNewUrlParser: true, useUnifiedTopology: true });
const mqttClient = mqtt.connect('mqtt://broker.emqx.io:1883');
mqttClient.on('connect', () => {
    mqttClient.subscribe('/VIAQ_Test_Employee/TH-MW01test01');
});
mqttClient.on('message', (topic, message) => {
    const mqttData = JSON.parse(message.toString());
    const { Temp_Value, Humi_Value } = mqttData;
    const message_time = new Date();
    amqp.connect('amqp://localhost').then((connection) => {
        return connection.createChannel();
    }).then((channel) => {
        const queueName = 'dataQueue';
        const queueNotif = 'notifQueue';
        const data = {
            Temp_Value: Temp_Value,
            Humi_Value: Humi_Value,
            lastSaved: message_time
        };
        channel.assertQueue(queueName, { durable: false });
        channel.assertQueue(queueNotif, { durable: false });
        channel.sendToQueue(queueName, Buffer.from(JSON.stringify(data)));
        // console.log('Message sent to RabbitMQ queue');
    }).catch((error) => {
        console.error('Error connecting to RabbitMQ:', error);
    });
});
amqp.connect('amqp://localhost').then((connection) => {
    return connection.createChannel();
}).then((channel) => {
    const queueName = 'dataQueue';
    const queueNotif = 'notifQueue';
    channel.assertQueue(queueName, { durable: false });
    channel.assertQueue(queueNotif, { durable: false });
    channel.consume(queueName, (msg) => {
        if (msg !== null) {
            const data = JSON.parse(msg.content.toString());
            const { Temp_Value, Humi_Value, lastSaved } = data;
            const tempCheckpoints = { min: 20, max: 30 }; // Sample range for Temp_Value
            const humiCheckpoints = { min: 40, max: 60 };
            const md5Hash = crypto.createHash('md5').update((Temp_Value + Humi_Value).toString()).digest('hex');
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

            const device = new Device(deviceData);
            device.save()
            // .then(() => {
            //     console.log('Data saved to MongoDB');
            // }).catch((err) => {
            //     console.error('Error saving data to MongoDB:', err);
            // });

            if (Temp_Value >= tempCheckpoints.min || Temp_Value <= tempCheckpoints.max ||
                Humi_Value >= humiCheckpoints.min || Humi_Value <= humiCheckpoints.max) {
                const notificationData = {
                    deviceId: device._id, 
                    parameter: 'Temperature and Humidity',
                    value: md5Hash, 
                    timestamp: new Date()
                };
                channel.sendToQueue(queueNotif, Buffer.from(JSON.stringify(notificationData)));
            }
            channel.ack(msg);
        }
    });


    channel.consume(queueNotif, (msg) => {
        if (msg !== null) {
            const notificationData = JSON.parse(msg.content.toString());
            const notification = new Notification(notificationData);
            notification.save()
            // .then(() => {
            //     console.log('Notification saved to MongoDB');
            // }).catch((err) => {
            //     console.error('Error saving notification to MongoDB:', err);
            // });

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