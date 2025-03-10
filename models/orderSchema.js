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
  cartTotal: {
    type: Number,
    required: true,
    min: 0,
  },
  discountAmount: {
    type: Number,
    default: 0,
    
  },
  discountedTotal: {
    type: Number,
    required: true
  },
  deliveryFee: {
    type: Number,
    default: 100
  },
  totalAmount : {
    type: Number,
    required: true
  },
  paymentMethod: {
    type: String,
    enum: ["COD", "ONLINE","Wallet"],
    required: true
  },
  paymentStatus: {
    type: String,
    enum: ["PENDING", "PAID", "FAILED","REFUNDED"],
    default: "PENDING"
  },
  orderStatus: {
    type: String,
    enum: ["PENDING", "PROCESSING", "Shipped", "DELIVERED", "CANCELLED","RETURN REQUESTED","RETURN CONFIRMED","RETURN REJECTED","RETURNED"],
    default: "PENDING"
  },
  paymentId: {
    type: String
  },
  couponCode: {
    type: String,
    default: ""
  },
  couponDiscount: {
    type: Number,
    default: 0
  }, 
  returnReason: {
    type: String,
    default: null
  },
  returnDetails: {
     type: String, 
     default: '' 
    },
  returnRequestedAt: { 
    type: Date 
  },
  razorpayOrderId: {
    type: String,
    default: null
  },
  trackingInfo: {
    carrier: String,
    trackingNumber: String
  }
}, { timestamps: true });

// orderSchema.index({ userId: 1, date: -1 });

// // Virtual for calculating total amount with discount
// orderSchema.virtual('discountedAmount').get(function() {
//     return this.totalAmount - this.couponDiscount; // Use couponDiscount instead
// });


const Order = mongoose.model("Order", orderSchema);
module.exports = Order;