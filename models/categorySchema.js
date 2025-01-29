const mongoose = require("mongoose");
const { Schema } = mongoose;

const categorySchema = new Schema({
    name: {
        type: String,
        required: true,
        unique: true,
        trim: true, // Removes leading and trailing whitespace
    },
    description: {
        type: String,
        required: true,
        trim: true,
    },
    isListed: {
        type: Boolean,
        default: true,
    },
    categoryOffer: {
        type: Number,
        default: 0,
    },
    isDeleted: {
        type: Boolean,
        default: false,
    },
    isBlocked : {
        type: Boolean,
        default: false
    }
}, { timestamps: true });

module.exports = mongoose.model("Category", categorySchema);
