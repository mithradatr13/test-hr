const mongoose = require('mongoose');
const Device = mongoose.model('Device', {
    serialNumber: String,
    checkpoints: {
        Temp_Value: { min: Number, max: Number },
        Humi_Value: { min: Number, max: Number }
    },
    lastSaved: Date,
    Temp_Value: Number,
    Humi_Value: Number,
    message_time: Date
});
module.exports = Device;