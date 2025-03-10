

const Product=require('../../models/productSchema')
const Products = require('../../models/productSchema');
const Category = require('../../models/categorySchema');


const getProductDetails = async (req,res) => {
   
    try {
        const { id } = req.params;
        const product = await Product.findById(id);
     
        const relatedProducts = await Product.find({ category: product.category, isBlocked: false });
        console.log("Total Stock:", product.totalStock);
        
        res.render('user/singleProduct', {
          product,
          productQuantity: product.totalStock,
          relatedProducts
        });
        
    } catch (error) {
        console.log(error.message)
    }
}

module.exports={
    getProductDetails
}