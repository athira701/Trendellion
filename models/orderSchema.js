const mongoose = require("mongoose");
const { Schema } = mongoose;
const { v4: uuidv4 } = require("uuid");



const orderSchema = new Schema({
  userId: {
    // or 'user' depending on your needs
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  orderId: {
    type: String,
    default: () => uuidv4(),
    unique: true,
  },

  addressRef: {
    type: Schema.Types.ObjectId,
    ref: "Address",
  },

  address: {
    addressType: String,
    name: String,
    landMark: String,
    city: String,
    state: String,
    pincode: String,
    phone: String,
    altPhone: String,
  },
  orderedItems: [
    {
      product: {
        type: Schema.Types.ObjectId,
        ref: "Product",
        required: true,
      },
      quantity: {
        type: Number,
        required: true,
        min: 1,
      },
      size:{
        type:String,
        required:true,

      },
      price: {
        type: Number,
        required: true,
        min: 0,
      },
    },
    
  ],
  totalPrice: {
    type: Number,
    required: true,
    min: 0,
  },
  discount: {
    type: Number,
    default: 0,
    
  },
  totalAmount: {
    type: Number,
    required: true
  },
  deliveryFee: {
    type: Number,
    default: 0
  },
  paymentMethod: {
    type: String,
    enum: ["COD", "ONLINE"],
    required: true
  },
  paymentStatus: {
    type: String,
    enum: ["PENDING", "PAID", "FAILED"],
    default: "PENDING"
  },
  orderStatus: {
    type: String,
    enum: ["PENDING", "PROCESSING", "Shipped", "DELIVERED", "CANCELLED","RETURN REQUESTED","RETURN CONFIRMED","RETURN REJECTED","RETURNED"],
    default: "PENDING"
  },
  trackingInfo: {
    carrier: String,
    trackingNumber: String
  }
}, { timestamps: true });

const Order = mongoose.model("Order", orderSchema);
module.exports = Order;