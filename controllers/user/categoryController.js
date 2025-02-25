const Category = require('../../models/categorySchema');
const Product=require('../../models/productSchema')

const displayCategoryProducts = async (req, res) => {
    try {
        const id = req.query.categoryId; // 'men', 'women', or 'kids'
        console.log("id",id)

        const page = Math.max(1, parseInt(req.query.page) || 1); 
        const limit = 6; 
        const skip = (page - 1) * limit;                         

        const searchTerm = req.query.search || '';               


        const searchQuery = {                                     
            isBlocked: false,
            status: 'Available'
        };                                                        
        if (searchTerm) {                                         
            searchQuery.productName = { 
                $regex: searchTerm, 
                $options: 'i' 
            };
        }                                                         

        const totalProducts = await Product.countDocuments(searchQuery);        
        const totalPages = Math.ceil(totalProducts / limit);                    
        

        // Query products with category and search
        const products = await Product.find({
            category: id
        })
        .sort({ createdAt: -1 }) // Latest products first        //
        .skip(skip)
        .limit(limit);                                           //

        console.log("products",products)
           

        // Get total products count for pagination
       

       

        res.render("user/category", {
            products,
            currentPage: page,
            totalProducts,
            totalPages,
            searchTerm

        });

    } catch (error) {
        console.error("Error in displayCategoryProducts:", error);
        res.status(500).send("Internal Server Error");
    }
}

module.exports = {
    displayCategoryProducts
}