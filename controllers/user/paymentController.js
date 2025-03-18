const Order = require('../../models/orderSchema')
const Razorpay = require('razorpay')
const crypto = require('crypto')
require('dotenv').config()

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });

//I am keeping this here for creating a payment order without all validation(just for testing)  
 const createOrder = async (req, res) => {
    try {
      const { amount } = req.body;
  
      const options = {
        amount: Math.round(amount * 100), 
        currency: "INR",
        receipt: `order_rcptid_${Date.now()}`,
      };
  
      const razorpayOrder = await razorpay.orders.create(options);
  
      res.status(200).json({ success: true, order: razorpayOrder });
    } catch (error) {
      console.error("Order creation failed:", error);
      res.status(500).json({ success: false, message: "Server error" });
    }
  
}




module.exports = {
    createOrder
}