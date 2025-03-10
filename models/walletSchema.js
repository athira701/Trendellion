const mongoose = require('mongoose')
const {Schema} = mongoose


const transactionSchema = new Schema({
    amount: {
        type: Number,
        required: true
    },
    transactionsMethod: {
        type: String,
        required: true
    },
    date: {
        type: Date,
        default:Date.now
    },
    orderId: {
        type: Schema.Types.ObjectId,
        ref: "Order"
    },
    status: {
        type: String,
        enum:['completed','pending'],
        default: 'completed'
    }
},{timestamps: true})


const walletSchema = new Schema ({
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    balance: {
        type: Number,
        required: true,
        default: 0
    },
    transactions: [transactionSchema]
},{timestamps: true})


const Wallet = mongoose.model('Wallet',walletSchema)
module.exports = Wallet