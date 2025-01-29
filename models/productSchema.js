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
            type: Number, required: true 
        },
        salePrice: { 
            type: Number, required: true 
        },
        quantity: { 
            type: Number, required: true 
        },
        color: { 
            type: String, required: true 
        },
        productImage: {
             type: [String], required: true 
        }, 
        isBlocked: { 
            type: Boolean, default: false 
        },
        status: {
            type: String,
            enum: ['Available', 'Out of Stock', 'Discontinued'],
            default: 'Available',
        },
    },
    { timestamps: true }
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
