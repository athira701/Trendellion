const Order = require('../../models/orderSchema');
const User = require('../../models/userSchema');
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');

const getSalesReport = async (req, res) => {
    try {
        res.render('admin/salesReport', {
            admin: req.session.admin,
            active: 'sales-report',
        });
    } catch (error) {
        console.log('Error while loading sales report:', error);
        res.status(500).send('Internal Server Error');
    }
};

const generateSalesReport = async (req, res) => {
    try {
        const { reportType, startDate, endDate } = req.body;
        
        // Create date range based on report type
        const dateRange = getDateRange(reportType, startDate, endDate);
        
        // Query orders based on date range and payment status
        const orders = await Order.find({
            createdAt: { $gte: dateRange.start, $lte: dateRange.end },
            paymentStatus: 'PAID',
        }).sort({ createdAt: -1 });
        
        if (!orders || orders.length === 0) {
            return res.status(404).json({ 
                status: 'error', 
                message: 'No orders found for the selected period' 
            });
        }
        
        // Process orders to calculate summary and format for display
        const processedData = processOrdersForReport(orders);
        
        return res.status(200).json({
            status: 'success',
            data: processedData
        });
    } catch (error) {
        console.error('Error generating sales report:', error);
        res.status(500).json({ status: 'error', message: 'Failed to generate report' });
    }
};

const exportSalesPDF = async (req, res) => {
    try {
        const { reportType, startDate, endDate } = req.body;
        
        // Create date range based on report type
        const dateRange = getDateRange(reportType, startDate, endDate);
        
        // Query orders based on date range
        const orders = await Order.find({
            createdAt: { $gte: dateRange.start, $lte: dateRange.end },
            paymentStatus: 'PAID',
        }).sort({ createdAt: -1 });
        
        if (!orders || orders.length === 0) {
            return res.status(404).json({ 
                status: 'error', 
                message: 'No orders found for the selected period' 
            });
        }
        
        // Process orders for the report
        const processedData = processOrdersForReport(orders);
        
        // Create PDF
        const doc = new PDFDocument({ margin: 50 });
        
        // Set response headers
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition',` attachment; filename=sales-report-${Date.now()}.pdf`);
        
        // Pipe PDF to response
        doc.pipe(res);
        
        // Add content to PDF
        generatePDFContent(doc, processedData, reportType, dateRange);
        
        // Finalize PDF
        doc.end();
        
    } catch (error) {
        console.error('Error exporting sales PDF:', error);
        res.status(500).json({ status: 'error', message: 'Failed to export PDF' });
    }
};

const exportSalesExcel = async (req, res) => {
    try {
        const { reportType, startDate, endDate } = req.body;
        
        // Create date range based on report type
        const dateRange = getDateRange(reportType, startDate, endDate);
        
        // Query orders based on date range
        const orders = await Order.find({
            createdAt: { $gte: dateRange.start, $lte: dateRange.end },
            paymentStatus: 'PAID',
        }).sort({ createdAt: -1 });
        
        if (!orders || orders.length === 0) {
            return res.status(404).json({ 
                status: 'error', 
                message: 'No orders found for the selected period' 
            });
        }
        
        // Process orders for the report
        const processedData = processOrdersForReport(orders);
        
        // Create Excel workbook
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Sales Report');
        
        // Add headers and content to Excel
        generateExcelContent(worksheet, processedData, reportType, dateRange);
        
        // Set response headers
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=sales-report-${Date.now()}.xlsx`);
        
        // Write to response
        await workbook.xlsx.write(res);
        res.end();
        
    } catch (error) {
        console.error('Error exporting sales Excel:', error);
        res.status(500).json({ status: 'error', message: 'Failed to export Excel' });
    }
};

function getDateRange(reportType, startDate, endDate) {
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    
    let start = new Date();
    let end = new Date(today);
    
    switch (reportType) {
        case 'daily':
            // Set start to beginning of current day
            start.setHours(0, 0, 0, 0);
            break;
            
        case 'weekly':
            // Set start to beginning of current week (Sunday)
            const dayOfWeek = start.getDay();
            start.setDate(start.getDate() - dayOfWeek);
            start.setHours(0, 0, 0, 0);
            break;
            
        case 'monthly':
            // Set start to beginning of current month
            start.setDate(1);
            start.setHours(0, 0, 0, 0);
            break;
            
        case 'custom':
            // Use provided dates
            start = new Date(startDate);
            start.setHours(0, 0, 0, 0);
            end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            break;
    }
    
    return { start, end };
}

// Process orders for the report
function processOrdersForReport(orders) {
    let totalSales = 0;
    let totalDiscounts = 0;
    
    // Format orders for display in table
    const formattedOrders = orders.map(order => {
        const orderAmount = order.cartTotal || 0;
        const discount = (order.discountAmount || 0) + (order.couponDiscount || 0);
        const finalAmount = order.totalAmount || 0;
        
        totalSales += finalAmount;
        totalDiscounts += discount;
        
        return {
            date: order.createdAt,
            orderId: order.orderId,
            amount: orderAmount,
            discount: discount,
            couponCode: order.couponCode,
            finalAmount: finalAmount
        };
    });
    
    return {
        orders: formattedOrders,
        summary: {
            totalSales,
            totalOrders: orders.length,
            totalDiscounts
        }
    };
}

// Generate PDF content
function generatePDFContent(doc, data, reportType, dateRange) {
    // Add title
    doc.fontSize(20).text('Sales Report', { align: 'center' });
    doc.moveDown();
    
    // Add report period
    const periodStart = dateRange.start.toLocaleDateString();
    const periodEnd = dateRange.end.toLocaleDateString();
    doc.fontSize(12).text(`Report Type: ${reportType.charAt(0).toUpperCase() + reportType.slice(1)}`, { align: 'left' });
    doc.fontSize(12).text(`Period: ${periodStart} to ${periodEnd}`, { align: 'left' });
    doc.moveDown();
    
    // Add summary
    doc.fontSize(16).text('Summary', { align: 'left' });
    doc.moveDown(0.5);
    doc.fontSize(12).text(`Total Sales: ₹${data.summary.totalSales.toFixed(2)}`, { align: 'left' });
    doc.fontSize(12).text(`Total Orders: ${data.summary.totalOrders}`, { align: 'left' });
    doc.fontSize(12).text(`Total Discounts: ₹${data.summary.totalDiscounts.toFixed(2)}`, { align: 'left' });
    doc.moveDown();
    
    // Add table header
    doc.fontSize(14).text('Order Details', { align: 'left' });
    doc.moveDown(0.5);
    
    const tableTop = doc.y;
    const tableLeft = 50;
    const colWidths = [80, 100, 80, 80, 100, 80];
    
    // Draw table header
    doc.fontSize(8).font('Helvetica-Bold');
    doc.text('Date', tableLeft, tableTop);
    doc.text('Order ID', tableLeft + colWidths[0], tableTop);
    doc.text('Amount', tableLeft + colWidths[0] + colWidths[1], tableTop);
    doc.text('Discount', tableLeft + colWidths[0] + colWidths[1] + colWidths[2], tableTop);
    doc.text('Coupon Used', tableLeft + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3], tableTop);
    doc.text('Final Amount', tableLeft + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + colWidths[4], tableTop);
    
    doc.moveDown();
    let currentY = doc.y;
    
    // Draw table rows
    doc.font('Helvetica');
    data.orders.forEach((order, index) => {
        // Check if we need a new page
        if (currentY > doc.page.height - 100) {
            doc.addPage();
            currentY = 50;
        }
        
        doc.fontSize(9);
        doc.text(new Date(order.date).toLocaleDateString(), tableLeft, currentY);
        doc.text(order.orderId, tableLeft + colWidths[0], currentY);
        doc.text(`₹${order.amount.toFixed(2)}`, tableLeft + colWidths[0] + colWidths[1], currentY);
        doc.text(`₹${order.discount.toFixed(2)}`, tableLeft + colWidths[0] + colWidths[1] + colWidths[2], currentY);
        doc.text(order.couponCode || 'No coupon', tableLeft + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3], currentY);
        doc.text(`₹${order.finalAmount.toFixed(2)}`, tableLeft + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + colWidths[4], currentY);
        
        currentY += 20;
    });
    
    // Add footer
    const pageCount = doc.bufferedPageRange().count;
    for (let i = 0; i < pageCount; i++) {
        doc.switchToPage(i);
        doc.fontSize(8);
        doc.text(`Page ${i + 1} of ${pageCount}`, 50, doc.page.height - 50, {
            align: 'center'
        });
        doc.text(`Generated on: ${new Date().toLocaleString()}`, 50, doc.page.height - 35, {
            align: 'center'
        });
    }
}

// Generate Excel content
function generateExcelContent(worksheet, data, reportType, dateRange) {
    // Add title and info
    worksheet.mergeCells('A1:F1');
    worksheet.getCell('A1').value = 'Sales Report';
    worksheet.getCell('A1').font = { size: 16, bold: true };
    worksheet.getCell('A1').alignment = { horizontal: 'center' };
    
    // Add report period
    const periodStart = dateRange.start.toLocaleDateString();
    const periodEnd = dateRange.end.toLocaleDateString();
    worksheet.getCell('A3').value = `Report Type: ${reportType.charAt(0).toUpperCase() + reportType.slice(1)}`;
    worksheet.getCell('A4').value = `Period: ${periodStart} to ${periodEnd}`;
    
    // Add summary
    worksheet.getCell('A6').value = 'Summary';
    worksheet.getCell('A6').font = { size: 14, bold: true };
    
    worksheet.getCell('A7').value = 'Total Sales:';
    worksheet.getCell('B7').value = data.summary.totalSales;
    worksheet.getCell('B7').numFmt = '₹#,##0.00';
    
    worksheet.getCell('A8').value = 'Total Orders:';
    worksheet.getCell('B8').value = data.summary.totalOrders;
    
    worksheet.getCell('A9').value = 'Total Discounts:';
    worksheet.getCell('B9').value = data.summary.totalDiscounts;
    worksheet.getCell('B9').numFmt = '₹#,##0.00';
    
    // Add table header
    worksheet.getCell('A11').value = 'Order Details';
    worksheet.getCell('A11').font = { size: 14, bold: true };
    
    // Define columns
    worksheet.columns = [
        { header: 'Date', key: 'date', width: 15 },
        { header: 'Order ID', key: 'orderId', width: 20 },
        { header: 'Amount', key: 'amount', width: 15 },
        { header: 'Discount', key: 'discount', width: 15 },
        { header: 'Coupon Used', key: 'coupon', width: 20 },
        { header: 'Final Amount', key: 'finalAmount', width: 15 }
    ];
    
    // Style the header row
    worksheet.getRow(12).font = { bold: true };
    worksheet.getRow(12).alignment = { horizontal: 'center' };
    worksheet.getRow(12).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' }
    };
    
    // Add the data
    const rows = data.orders.map(order => {
        return {
            date: new Date(order.date),
            orderId: order.orderId,
            amount: order.amount,
            discount: order.discount,
            coupon: order.couponCode || 'No coupon',
            finalAmount: order.finalAmount
        };
    });
    
    rows.forEach(row => {
        worksheet.addRow(row);
    });
    
    // Format the currency columns
    const rowCount = rows.length + 12; // header is on row 12
    for (let i = 13; i <= rowCount; i++) {
        worksheet.getCell(`C${i}`).numFmt = '₹#,##0.00';
        worksheet.getCell(`D${i}`).numFmt = '₹#,##0.00';
        worksheet.getCell(`F${i}`).numFmt = '₹#,##0.00';
    }
    
    // Format date column
    for (let i = 13; i <= rowCount; i++) {
        worksheet.getCell(`A${i}`).numFmt = 'dd/mm/yyyy';
    }
    
    // Add borders to the table
    for (let i = 12; i <= rowCount; i++) {
        ['A', 'B', 'C', 'D', 'E', 'F'].forEach(col => {
            worksheet.getCell(`${col}${i}`).border = {
                top: { style: 'thin' },
                left: { style: 'thin' },
                bottom: { style: 'thin' },
                right: { style: 'thin' }
            };
        });
    }
    
    // Alternate row colors for better readability
    for (let i = 13; i <= rowCount; i++) {
        if (i % 2 === 1) {
            ['A', 'B', 'C', 'D', 'E', 'F'].forEach(col => {
                worksheet.getCell(`${col}${i}`).fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FFF9F9F9' }
                };
            });
        }
    }
    
    // Add footer
    worksheet.getCell(`A${rowCount + 2}`).value = `Generated on: ${new Date().toLocaleString()}`;
    worksheet.getCell(`A${rowCount + 2}`).font = { italic: true };
}

module.exports = {
    getSalesReport,
    generateSalesReport,
    exportSalesExcel,
    exportSalesPDF
}