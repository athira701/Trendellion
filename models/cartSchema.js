const mongoose = require('mongoose');
const {Schema} = mongoose;

const cartSchema = new Schema({
    userId: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required : true
    },
    item: [{
        productId: {
            type: Schema.Types.ObjectId,
            ref: "Product",
            required: true
        },
        name: {
            type: String,
            required: true,
        },
        size: {
            type: String,
            required: true
        },
        quantity: {
            type: Number,
            required: true,
            min: 1
        },
        price: {
            type: Number,
            required: true
        },
        stock: {
            type: Number,
            required: true
        },
        total: {
            type: Number,
            required: true
        }
   }],
   cartTotal: {
    type: Number,
    required: true
   },
   appliedCoupon: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Coupon',
    default: null
   },
   discountAmount: {
    type: Number,
    default: 0
   },
   discountedTotal: {
    type: Number,
    default: function() {
        return this.cartTotal;
    }
}
},{timestamps: true});

// Add a pre-save middleware to calculate discountedTotal
cartSchema.pre('save', function(next) {
    if (this.discountAmount) {
        this.discountedTotal = this.cartTotal - this.discountAmount;
    } else {
        this.discountedTotal = this.cartTotal;
    }
    next();
});
// cartSchema.pre('save', function(next) {
//     this.discountedTotal = this.cartTotal - (this.discountAmount || 0);
//     next();
//   });

const Cart = mongoose.model('Cart',cartSchema);
module.exports = Cart;