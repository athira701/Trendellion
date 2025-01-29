const Category = require("../../models/categorySchema")

const categoryInfo = async (req, res) => {
    try {

        const querySearch = req.query.search || ""
        const currentPage = parseInt(req.query.page,10) || 1;

        const limit = 4;
        const skip = (currentPage - 1) * limit;

        const categoryDate = await Category.find({
            isDeleted: false,
            name:{$regex:`.*${querySearch}.*`,$options:"i"}
        }) 
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        const totalCategories = await Category.countDocuments({ isDeleted: false, name: { $regex: `.*${querySearch}.*`, $options: "i" } });
        const totalPages = Math.ceil(totalCategories / limit);

        res.render("admin/category", {
            cat: categoryDate,
            currentPage,
            totalPages: totalPages,
            categories: totalCategories,
            topCategories: totalCategories,
            searchQuery: querySearch
        });

        console.log(categoryDate);
    } catch (error) {
        console.error(error);
    }
};

const loadAddCategory = async (req,res)=>{

    try {
        res.render('admin/addCat')
    } catch (error) {
        
    }
}

// Backend: addCategory.js
const addCategory = async (req, res) => {
    try {
        // Destructure name and description from request body
        const { name, description } = req.body;
        console.log('Request Body:', req.body);

        // Validate inputs
        if (!name || !description) {
            return res.status(400).json({ success: false, message: 'Name and description are required' });
        }

        const namePattern = /^[A-Za-z][A-Za-z\s]{2,}$/ // Minimum 3 words, only alphabets, starts with a letter.
        if (!namePattern.test(name.trim())) {
            return res.status(400).json({ success: false, message: 'Category name must contain only alphabets, start with a letter, and have at least 3 words.' });
        }

        if (description.trim().length < 10 || description.trim().length > 250) {
            return res.status(400).json({ 
                success: false, 
                message: 'Category description must have between 10 and 250 characters.' 
            });
        }

        const existingCategory = await Category.findOne({ name: name.trim() });
        if (existingCategory) {
            return res.status(400).json({ 
                success: false, 
                message: 'Category with the same name already exists.' 
            });
        }


        // Create a new category
        const newCategory = new Category({ name, description });
        await newCategory.save();

        // Send a success response
        return res.status(201).json({ success: true, message: 'Category added successfully!' });

    } catch (error) {
        console.error('Error while adding category:', error);

        // Send an error response
        return res.status(500).json({ success: false, message: 'Server error occurred' });
    }
};

const getCategory = async (req, res) => {
    try {
        const categories = await Category.find({}); // No filter for isDeleted
        res.render('admin/category', {
            cat: categories,
            
        });
    } catch (error) {
        console.error('Error fetching categories:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
};

const deleteCategory = async (req, res) => {
    const categoryId = req.params.id;
    

    try {
        
        const result = await Category.findByIdAndUpdate({_id:categoryId},{$set:{ isDeleted: true }},{ new: true });
        console.log("Updated category :",result)

        if (result) {
            return res.status(200).json({ success: true, message: 'Category soft deleted successfully' });
        } else {
            console.log("Category not found:", categoryId);
            return res.status(404).json({ success: false, error: 'Category not found' });
        }
    } catch (error) {
        console.error('Error soft deleting category:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
};

const restoreCategory = async (req, res) => {
    const categoryId = req.params.id;

    try {
        const result = await Category.findByIdAndUpdate({_id:categoryId}, {$set:{ isDeleted: false }},{ new: true });
        console.log("Restored category :",result)
        

        if (result) {
            return res.status(200).json({ success: true, message: "Category restored successfully" });
        } else {
            return res.status(404).json({ success: false, error: "Category not found" });
        }
    } catch (error) {
        console.error("Error restoring category:", error);
        res.status(500).json({ success: false, error: "Internal server error" });
     }
};


const getEditCategory = async (req,res) =>{
    try {
        const categoryId = req.query.id

        const category = await Category.findById(categoryId)
        
        if(!category){
            return res.status(404).send("Category not found")
        }

        res.render('admin/editCategory',{
            category
        })
    } catch (error) {
        console.log(error)
    }
}

const editCategory = async (req, res) => {
    try {
        const { id, name, description } = req.body;

        if (!id || !name || !description) {
            return res.status(400).json({ success : false,message : "All fields are required"});
        }

        const namePattern = /^[A-Za-z][A-Za-z\s]{2,}$/ // Minimum 3 words, only alphabets, starts with a letter.
        if (!namePattern.test(name.trim())) {
            return res.status(400).json({ success: false, message: 'Category name must contain only alphabets, start with a letter, and have at least 3 words.' });
        }

        if (description.trim().length < 10 || description.trim().length > 250) {
            return res.status(400).json({ 
                success: false, 
                message: 'Category description must have between 10 and 250 characters.' 
            });
        }

        const updatedCategory = await Category.findByIdAndUpdate(
            id,
            { name, description },
            { new: true } // Return the updated document
        );

        if (!updatedCategory) {
            return res.status(404).json({success : false,message: "Category not found"});
        }

        return res.status(201).json({ success: true, message: 'Category edited successfully!' });


    } catch (error) {
        console.error(error.message);
        res.status(500).send({ success: false, message: 'Server error' });
    }
}

const blockOrUnblockCategory = async (req, res) => {
    try {
        const { categoryId, action } = req.body;

        if (!categoryId || !action) {
            return res.status(400).json({ success: false, message: "Invalid request data" });
        }

        const category = await Category.findById(categoryId);

        if (!category) {
            return res.status(404).json({ success: false, message: "Category not found" });
        }

        category.isBlocked = action === "block";
        await category.save();

        res.status(200).json({
            success: true,
            isBlocked: category.isBlocked,
            message: category.isBlocked ? "Category blocked successfully" : "Category unblocked successfully",
        });
    } catch (error) {
        console.error("Error toggling block/unblock:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};




module.exports={
    categoryInfo,
    addCategory,
    getCategory,
    deleteCategory,
    restoreCategory,
    getEditCategory,
    editCategory,
    blockOrUnblockCategory,
    loadAddCategory,
    

}