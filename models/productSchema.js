const mongoose = require('mongoose');
const { Schema } = mongoose;

const productSchema = new Schema({
        productName: {
            type: String, 
            required: true,
            trim: true 
        },
        description:{
            type: String
        },       
        category:{
            type: Schema.Types.ObjectId,
            ref: 'Category', 
            required: true 
        },
        regularPrice: {
            type: Number,
            required: true 
        },
        salePrice: { 
            type: Number,
            required: true 
        },
    
        stock: [
            {
                quantity: {
                    type: Number,
                    required:true
                },
                size: {
                    type: String,
                    required: true
                }
            }
        ],
        totalStock:{
            type:Number,
            required:true
        },    
        productImage: {
             type: [String],
             required: true 
        },
        rating:{
            type: Number,
            default: 0
        }, 
        isBlocked: { 
            type: Boolean,
            default: false 
        },
        status: {
            type: String,
            enum: ['Available', 'Out of Stock', 'Discontinued'],
            required: true,
            default: 'Available',
        },
        purchaseCount: {
            type: Number,
            default: 0
        },
        isFeatured: {
            type: Boolean,
            default: false
        }
    },{ timestamps: true }
);







productSchema.pre('save', function (next) {
    this.status = this.quantity === 0 ? 'Out of Stock' : 'Available';
    next();
});

productSchema.pre('findOneAndUpdate', function (next) {
    const update = this.getUpdate();
    if (update.$set && update.$set.quantity !== undefined) {
        update.$set.status = update.$set.quantity === 0 ? 'Out of Stock' : 'Available';
    }
    next();
});

const Product = mongoose.model('Product', productSchema);
module.exports = Product;
