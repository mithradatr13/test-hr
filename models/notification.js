const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema({
    deviceId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Device',
        required: true
    },
    parameter: {
        type: String,
        required: true
    },
    value: {
        type: String,
        required: true
    },
    timestamp: {
        type: Date,
        required: true
    }
});

const Notification = mongoose.model('Notification', NotificationSchema);

module.exports = Notification;