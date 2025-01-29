const User = require("../../models/userSchema")




const customerInfo = async (req, res) => {
    try {
        const querySearch = req.query.search || ""; // Default to empty string for search
        const currentPage = parseInt(req.query.page, 10) || 1; // Default to page 1
        const limit = 10; // Number of users to show per page

        // Fetch user data with pagination and search
        const userData = await User.find({
            isAdmin: false,
            $or: [
                { name: { $regex: `.*${querySearch}.*`, $options: "i" } },
                { email: { $regex: `.*${querySearch}.*`, $options: "i" } }
            ]
        }).sort({ createdAt: -1 })
            .skip((currentPage - 1) * limit)
            .limit(limit) // Skip the users for previous pages
            .exec();

        // Count total matching users for pagination
        const totalUsers = await User.countDocuments({
            isAdmin: false,
            $or: [
                { name: { $regex: `.*${querySearch}.*`, $options: "i" } },
                { email: { $regex: `.*${querySearch}.*`, $options: "i" } }
            ]
        });

        const totalPages = Math.ceil(totalUsers / limit);

        // Render the view with user data and pagination details
        res.render("admin/customer", {
            data: userData,
            totalPages,
            currentPage,
            searchQuery: querySearch
        });
    } catch (error) {
        console.error("Error fetching customer info:", error);
        res.status(500).send("An error occurred while fetching customer information.");
    }
};



const blockOrUnblockUser = async (req, res) => {
    try {
        const { user_id } = req.body;
        const user = await User.findById(user_id);

        if (!user) {
            return res.status(404).json({ res: false, message: "User not found" });
        }

        user.isBlocked = !user.isBlocked;
        await user.save();

        res.status(200).json({
            res: true,
            is_blocked: user.isBlocked,
            message: user.isBlocked ? 'User blocked' : 'User unblocked',
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            res: false,
            message: "An error occurred while updating the user's status",
        });
    }
};

const loadCustomer = async (req,res) =>{
    try {
        res.render("admin/customer")
    } catch (error) {
        
    }
}
module.exports = {
    customerInfo,
   
    loadCustomer,
    blockOrUnblockUser
}