-- E-Commerce Test Database
-- This script creates a complete e-commerce database with realistic data
-- Perfect for testing the RAG system

-- Create database (uncomment if needed)
-- CREATE DATABASE ecommerce_test;
-- USE ecommerce_test;

-- Drop tables if they exist (for clean setup)
DROP TABLE IF EXISTS order_items CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS product_reviews CASCADE;
DROP TABLE IF EXISTS product_categories CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS categories CASCADE;
DROP TABLE IF EXISTS customers CASCADE;
DROP TABLE IF EXISTS suppliers CASCADE;
DROP TABLE IF EXISTS inventory CASCADE;

-- Create tables

-- Customers table
CREATE TABLE customers (
    customer_id SERIAL PRIMARY KEY,
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    phone VARCHAR(20),
    address TEXT,
    city VARCHAR(50),
    state VARCHAR(50),
    country VARCHAR(50),
    postal_code VARCHAR(20),
    registration_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    total_orders INTEGER DEFAULT 0,
    total_spent DECIMAL(10,2) DEFAULT 0.00,
    is_active BOOLEAN DEFAULT TRUE
);

-- Categories table
CREATE TABLE categories (
    category_id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    parent_category_id INTEGER REFERENCES categories(category_id),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Suppliers table
CREATE TABLE suppliers (
    supplier_id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    contact_person VARCHAR(100),
    email VARCHAR(100),
    phone VARCHAR(20),
    address TEXT,
    city VARCHAR(50),
    country VARCHAR(50),
    rating DECIMAL(3,2) DEFAULT 0.00,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Products table
CREATE TABLE products (
    product_id SERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    sku VARCHAR(50) UNIQUE,
    category_id INTEGER REFERENCES categories(category_id),
    supplier_id INTEGER REFERENCES suppliers(supplier_id),
    price DECIMAL(10,2) NOT NULL,
    cost_price DECIMAL(10,2),
    weight DECIMAL(8,2),
    dimensions VARCHAR(50),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Product categories (many-to-many relationship)
CREATE TABLE product_categories (
    product_id INTEGER REFERENCES products(product_id),
    category_id INTEGER REFERENCES categories(category_id),
    PRIMARY KEY (product_id, category_id)
);

-- Inventory table
CREATE TABLE inventory (
    inventory_id SERIAL PRIMARY KEY,
    product_id INTEGER REFERENCES products(product_id),
    warehouse_location VARCHAR(100),
    quantity_in_stock INTEGER DEFAULT 0,
    reorder_level INTEGER DEFAULT 10,
    last_restocked TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Orders table
CREATE TABLE orders (
    order_id SERIAL PRIMARY KEY,
    customer_id INTEGER REFERENCES customers(customer_id),
    order_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(50) DEFAULT 'pending',
    total_amount DECIMAL(10,2) NOT NULL,
    shipping_address TEXT,
    billing_address TEXT,
    payment_method VARCHAR(50),
    payment_status VARCHAR(50) DEFAULT 'pending',
    shipping_cost DECIMAL(8,2) DEFAULT 0.00,
    tax_amount DECIMAL(8,2) DEFAULT 0.00,
    discount_amount DECIMAL(8,2) DEFAULT 0.00,
    notes TEXT
);

-- Order items table
CREATE TABLE order_items (
    order_item_id SERIAL PRIMARY KEY,
    order_id INTEGER REFERENCES orders(order_id),
    product_id INTEGER REFERENCES products(product_id),
    quantity INTEGER NOT NULL,
    unit_price DECIMAL(10,2) NOT NULL,
    total_price DECIMAL(10,2) NOT NULL,
    discount_percentage DECIMAL(5,2) DEFAULT 0.00
);

-- Product reviews table
CREATE TABLE product_reviews (
    review_id SERIAL PRIMARY KEY,
    product_id INTEGER REFERENCES products(product_id),
    customer_id INTEGER REFERENCES customers(customer_id),
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    review_text TEXT,
    review_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_verified_purchase BOOLEAN DEFAULT FALSE
);

-- Insert sample data

-- Insert customers
INSERT INTO customers (first_name, last_name, email, phone, address, city, state, country, postal_code, total_orders, total_spent) VALUES
('John', 'Smith', 'john.smith@email.com', '+1-555-0101', '123 Main St', 'New York', 'NY', 'USA', '10001', 5, 1250.00),
('Sarah', 'Johnson', 'sarah.j@email.com', '+1-555-0102', '456 Oak Ave', 'Los Angeles', 'CA', 'USA', '90210', 3, 890.00),
('Michael', 'Brown', 'michael.b@email.com', '+1-555-0103', '789 Pine Rd', 'Chicago', 'IL', 'USA', '60601', 8, 2100.00),
('Emily', 'Davis', 'emily.d@email.com', '+1-555-0104', '321 Elm St', 'Houston', 'TX', 'USA', '77001', 2, 450.00),
('David', 'Wilson', 'david.w@email.com', '+1-555-0105', '654 Maple Dr', 'Phoenix', 'AZ', 'USA', '85001', 6, 1675.00),
('Lisa', 'Anderson', 'lisa.a@email.com', '+1-555-0106', '987 Cedar Ln', 'Philadelphia', 'PA', 'USA', '19101', 4, 980.00),
('Robert', 'Taylor', 'robert.t@email.com', '+1-555-0107', '147 Birch Way', 'San Antonio', 'TX', 'USA', '78201', 7, 1890.00),
('Jennifer', 'Martinez', 'jennifer.m@email.com', '+1-555-0108', '258 Spruce Ct', 'San Diego', 'CA', 'USA', '92101', 3, 720.00),
('William', 'Garcia', 'william.g@email.com', '+1-555-0109', '369 Willow Pl', 'Dallas', 'TX', 'USA', '75201', 5, 1350.00),
('Amanda', 'Rodriguez', 'amanda.r@email.com', '+1-555-0110', '741 Aspen Blvd', 'San Jose', 'CA', 'USA', '95101', 2, 580.00);

-- Insert categories
INSERT INTO categories (name, description) VALUES
('Electronics', 'Electronic devices and accessories'),
('Clothing', 'Apparel and fashion items'),
('Home & Garden', 'Home improvement and garden supplies'),
('Books', 'Books and educational materials'),
('Sports & Outdoors', 'Sports equipment and outdoor gear'),
('Beauty & Health', 'Beauty products and health supplements'),
('Toys & Games', 'Toys, games, and entertainment'),
('Automotive', 'Automotive parts and accessories'),
('Food & Beverages', 'Food items and beverages'),
('Jewelry', 'Jewelry and accessories');

-- Insert subcategories
INSERT INTO categories (name, description, parent_category_id) VALUES
('Smartphones', 'Mobile phones and accessories', 1),
('Laptops', 'Portable computers and accessories', 1),
('Tablets', 'Tablet computers and accessories', 1),
('Men''s Clothing', 'Clothing for men', 2),
('Women''s Clothing', 'Clothing for women', 2),
('Kids'' Clothing', 'Clothing for children', 2),
('Furniture', 'Home furniture and decor', 3),
('Garden Tools', 'Tools for gardening', 3),
('Fiction', 'Fiction books and novels', 4),
('Non-Fiction', 'Non-fiction books and educational materials', 4);

-- Insert suppliers
INSERT INTO suppliers (name, contact_person, email, phone, address, city, country, rating) VALUES
('TechCorp Industries', 'Alice Johnson', 'alice@techcorp.com', '+1-555-0201', '100 Tech Blvd', 'San Francisco', 'USA', 4.5),
('Fashion Forward Ltd', 'Bob Smith', 'bob@fashionforward.com', '+1-555-0202', '200 Fashion Ave', 'New York', 'USA', 4.2),
('Home Essentials Co', 'Carol Davis', 'carol@homeessentials.com', '+1-555-0203', '300 Home St', 'Chicago', 'USA', 4.7),
('Book World Publishers', 'David Wilson', 'david@bookworld.com', '+1-555-0204', '400 Book Rd', 'Boston', 'USA', 4.3),
('Sports Gear Pro', 'Eva Martinez', 'eva@sportsgear.com', '+1-555-0205', '500 Sports Way', 'Denver', 'USA', 4.6),
('Beauty Plus Inc', 'Frank Garcia', 'frank@beautyplus.com', '+1-555-0206', '600 Beauty Ln', 'Miami', 'USA', 4.4),
('Toy Kingdom', 'Grace Lee', 'grace@toykingdom.com', '+1-555-0207', '700 Toy Ct', 'Seattle', 'USA', 4.1),
('Auto Parts Express', 'Henry Brown', 'henry@autoparts.com', '+1-555-0208', '800 Auto Blvd', 'Detroit', 'USA', 4.8),
('Fresh Foods Co', 'Ivy Chen', 'ivy@freshfoods.com', '+1-555-0209', '900 Food Dr', 'Portland', 'USA', 4.9),
('Jewelry Masters', 'Jack Taylor', 'jack@jewelrymasters.com', '+1-555-0210', '1000 Jewel Pl', 'Las Vegas', 'USA', 4.7);

-- Insert products
INSERT INTO products (name, description, sku, category_id, supplier_id, price, cost_price, weight, dimensions) VALUES
('iPhone 15 Pro', 'Latest Apple smartphone with advanced features', 'IPH15PRO-128', 11, 1, 999.99, 650.00, 0.5, '6.1x3.0x0.3'),
('Samsung Galaxy S24', 'Premium Android smartphone', 'SAMS24-256', 11, 1, 899.99, 580.00, 0.48, '6.2x3.0x0.3'),
('MacBook Air M2', 'Lightweight laptop with M2 chip', 'MBA-M2-13', 12, 1, 1199.99, 800.00, 2.7, '12.0x8.5x0.6'),
('Dell XPS 13', 'Premium Windows laptop', 'DLLXPS13-512', 12, 1, 1099.99, 720.00, 2.8, '11.9x8.0x0.6'),
('iPad Air', 'Versatile tablet for work and play', 'IPAD-AIR-64', 13, 1, 599.99, 380.00, 1.0, '9.7x7.0x0.2'),
('Men''s Casual T-Shirt', 'Comfortable cotton t-shirt for men', 'TSH-M-CAS-001', 14, 2, 24.99, 12.00, 0.2, 'M'),
('Women''s Summer Dress', 'Elegant summer dress for women', 'DRS-W-SUM-001', 15, 2, 89.99, 45.00, 0.4, 'S/M/L'),
('Kids'' Winter Jacket', 'Warm winter jacket for children', 'JKT-K-WIN-001', 16, 2, 59.99, 30.00, 0.8, '4-12'),
('Leather Sofa', 'Premium leather living room sofa', 'SOF-LTH-3S', 17, 3, 899.99, 450.00, 45.0, '84x35x32'),
('Garden Shovel', 'Heavy-duty garden shovel', 'TLS-GDN-SHV', 18, 3, 29.99, 15.00, 2.5, '48x8x2'),
('The Great Gatsby', 'Classic American novel by F. Scott Fitzgerald', 'BK-FIC-GAT', 19, 4, 12.99, 6.50, 0.5, '5.5x8.5x0.8'),
('Python Programming Guide', 'Comprehensive Python programming book', 'BK-NON-PYT', 20, 4, 39.99, 20.00, 1.2, '7.0x9.0x1.0'),
('Nike Running Shoes', 'Professional running shoes', 'SHO-NKE-RUN', 5, 5, 129.99, 65.00, 1.0, '10'),
('Yoga Mat', 'Premium yoga mat for home practice', 'SPT-YOG-MAT', 5, 5, 49.99, 25.00, 2.0, '72x24x0.2'),
('Vitamin C Supplements', 'High-quality vitamin C tablets', 'HLT-VIT-C-100', 6, 6, 19.99, 8.00, 0.3, '2x2x4'),
('Face Cream', 'Anti-aging face cream', 'BTY-FAC-CRM', 6, 6, 34.99, 15.00, 0.2, '2x2x2'),
('LEGO Star Wars Set', 'Collector''s edition LEGO set', 'TOY-LEG-SW', 7, 7, 79.99, 40.00, 1.5, '12x8x3'),
('Board Game Collection', 'Family board game set', 'TOY-BRD-GAM', 7, 7, 44.99, 22.00, 2.0, '10x10x2'),
('Car Air Filter', 'High-performance air filter', 'AUT-AIR-FLT', 8, 8, 24.99, 12.00, 0.5, '8x8x2'),
('Motor Oil 5W-30', 'Synthetic motor oil', 'AUT-OIL-5W30', 8, 8, 39.99, 20.00, 1.0, '4x4x8'),
('Organic Coffee Beans', 'Premium organic coffee beans', 'FOD-COF-ORG', 9, 9, 24.99, 12.00, 1.0, '8x6x2'),
('Dark Chocolate Bars', 'Premium dark chocolate', 'FOD-CHO-DRK', 9, 9, 8.99, 4.00, 0.3, '4x2x0.5'),
('Diamond Ring', '14k gold diamond ring', 'JWL-DIA-RNG', 10, 10, 2999.99, 1500.00, 0.1, 'Ring size 7'),
('Silver Necklace', 'Sterling silver necklace', 'JWL-SLV-NCK', 10, 10, 199.99, 80.00, 0.2, '18 inch');

-- Insert inventory
INSERT INTO inventory (product_id, warehouse_location, quantity_in_stock, reorder_level, last_restocked) VALUES
(1, 'Warehouse A - Section 1', 50, 10, '2024-01-15 10:00:00'),
(2, 'Warehouse A - Section 1', 35, 10, '2024-01-14 14:30:00'),
(3, 'Warehouse A - Section 2', 25, 5, '2024-01-13 09:15:00'),
(4, 'Warehouse A - Section 2', 30, 5, '2024-01-12 16:45:00'),
(5, 'Warehouse A - Section 1', 40, 10, '2024-01-11 11:20:00'),
(6, 'Warehouse B - Section 1', 100, 20, '2024-01-10 13:00:00'),
(7, 'Warehouse B - Section 1', 60, 15, '2024-01-09 15:30:00'),
(8, 'Warehouse B - Section 2', 45, 10, '2024-01-08 10:45:00'),
(9, 'Warehouse C - Section 1', 15, 3, '2024-01-07 14:20:00'),
(10, 'Warehouse C - Section 2', 80, 15, '2024-01-06 12:10:00'),
(11, 'Warehouse D - Section 1', 200, 30, '2024-01-05 09:30:00'),
(12, 'Warehouse D - Section 1', 75, 15, '2024-01-04 16:00:00'),
(13, 'Warehouse B - Section 3', 55, 10, '2024-01-03 11:45:00'),
(14, 'Warehouse B - Section 3', 90, 20, '2024-01-02 13:30:00'),
(15, 'Warehouse E - Section 1', 150, 25, '2024-01-01 10:15:00'),
(16, 'Warehouse E - Section 1', 70, 15, '2023-12-31 14:50:00'),
(17, 'Warehouse F - Section 1', 25, 5, '2023-12-30 12:20:00'),
(18, 'Warehouse F - Section 1', 40, 10, '2023-12-29 15:40:00'),
(19, 'Warehouse G - Section 1', 60, 12, '2023-12-28 09:25:00'),
(20, 'Warehouse G - Section 1', 85, 20, '2023-12-27 16:15:00'),
(21, 'Warehouse H - Section 1', 120, 25, '2023-12-26 11:30:00'),
(22, 'Warehouse H - Section 1', 200, 40, '2023-12-25 13:45:00'),
(23, 'Warehouse I - Section 1', 10, 2, '2023-12-24 10:10:00'),
(24, 'Warehouse I - Section 1', 35, 8, '2023-12-23 14:35:00');

-- Insert orders
INSERT INTO orders (customer_id, order_date, status, total_amount, shipping_address, billing_address, payment_method, payment_status, shipping_cost, tax_amount, discount_amount) VALUES
(1, '2024-01-15 10:30:00', 'delivered', 1024.98, '123 Main St, New York, NY 10001', '123 Main St, New York, NY 10001', 'credit_card', 'paid', 15.00, 82.00, 50.00),
(2, '2024-01-14 14:20:00', 'shipped', 914.98, '456 Oak Ave, Los Angeles, CA 90210', '456 Oak Ave, Los Angeles, CA 90210', 'paypal', 'paid', 12.00, 73.20, 0.00),
(3, '2024-01-13 16:45:00', 'processing', 1299.99, '789 Pine Rd, Chicago, IL 60601', '789 Pine Rd, Chicago, IL 60601', 'credit_card', 'paid', 0.00, 104.00, 0.00),
(4, '2024-01-12 11:15:00', 'delivered', 484.97, '321 Elm St, Houston, TX 77001', '321 Elm St, Houston, TX 77001', 'credit_card', 'paid', 10.00, 38.80, 0.00),
(5, '2024-01-11 09:30:00', 'shipped', 1724.97, '654 Maple Dr, Phoenix, AZ 85001', '654 Maple Dr, Phoenix, AZ 85001', 'paypal', 'paid', 20.00, 138.00, 100.00),
(6, '2024-01-10 13:45:00', 'delivered', 1034.97, '987 Cedar Ln, Philadelphia, PA 19101', '987 Cedar Ln, Philadelphia, PA 19101', 'credit_card', 'paid', 15.00, 82.80, 0.00),
(7, '2024-01-09 15:20:00', 'processing', 1949.97, '147 Birch Way, San Antonio, TX 78201', '147 Birch Way, San Antonio, TX 78201', 'credit_card', 'paid', 25.00, 156.00, 0.00),
(8, '2024-01-08 12:10:00', 'shipped', 769.97, '258 Spruce Ct, San Diego, CA 92101', '258 Spruce Ct, San Diego, CA 92101', 'paypal', 'paid', 10.00, 61.60, 0.00),
(9, '2024-01-07 10:30:00', 'delivered', 1399.97, '369 Willow Pl, Dallas, TX 75201', '369 Willow Pl, Dallas, TX 75201', 'credit_card', 'paid', 0.00, 112.00, 50.00),
(10, '2024-01-06 14:50:00', 'processing', 634.97, '741 Aspen Blvd, San Jose, CA 95101', '741 Aspen Blvd, San Jose, CA 95101', 'credit_card', 'paid', 10.00, 50.80, 0.00);

-- Insert order items
INSERT INTO order_items (order_id, product_id, quantity, unit_price, total_price, discount_percentage) VALUES
(1, 1, 1, 999.99, 999.99, 5.00),
(1, 6, 1, 24.99, 24.99, 0.00),
(2, 3, 1, 1199.99, 1199.99, 0.00),
(2, 14, 1, 49.99, 49.99, 0.00),
(2, 15, 2, 19.99, 39.98, 0.00),
(3, 3, 1, 1199.99, 1199.99, 0.00),
(3, 16, 1, 34.99, 34.99, 0.00),
(3, 17, 1, 79.99, 79.99, 0.00),
(4, 6, 2, 24.99, 49.98, 0.00),
(4, 7, 1, 89.99, 89.99, 0.00),
(4, 13, 1, 129.99, 129.99, 0.00),
(4, 18, 1, 44.99, 44.99, 0.00),
(5, 9, 1, 899.99, 899.99, 10.00),
(5, 10, 1, 29.99, 29.99, 0.00),
(5, 11, 1, 12.99, 12.99, 0.00),
(5, 12, 1, 39.99, 39.99, 0.00),
(6, 2, 1, 899.99, 899.99, 0.00),
(6, 8, 1, 59.99, 59.99, 0.00),
(6, 19, 1, 24.99, 24.99, 0.00),
(6, 20, 1, 39.99, 39.99, 0.00),
(7, 4, 1, 1099.99, 1099.99, 0.00),
(7, 5, 1, 599.99, 599.99, 0.00),
(7, 21, 2, 24.99, 49.98, 0.00),
(7, 22, 3, 8.99, 26.97, 0.00),
(8, 6, 3, 24.99, 74.97, 0.00),
(8, 7, 1, 89.99, 89.99, 0.00),
(8, 13, 1, 129.99, 129.99, 0.00),
(8, 14, 1, 49.99, 49.99, 0.00),
(9, 1, 1, 999.99, 999.99, 5.00),
(9, 9, 1, 899.99, 899.99, 0.00),
(9, 23, 1, 2999.99, 2999.99, 0.00),
(10, 6, 2, 24.99, 49.98, 0.00),
(10, 8, 1, 59.99, 59.99, 0.00),
(10, 15, 1, 19.99, 19.99, 0.00),
(10, 16, 1, 34.99, 34.99, 0.00),
(10, 18, 1, 44.99, 44.99, 0.00);

-- Insert product reviews
INSERT INTO product_reviews (product_id, customer_id, rating, review_text, review_date, is_verified_purchase) VALUES
(1, 1, 5, 'Excellent phone! The camera quality is amazing and battery life is great.', '2024-01-16 10:00:00', TRUE),
(1, 3, 4, 'Good phone overall, but a bit expensive. Camera is fantastic.', '2024-01-15 14:30:00', TRUE),
(2, 2, 5, 'Love this Samsung phone! Great performance and beautiful display.', '2024-01-14 16:45:00', TRUE),
(3, 5, 5, 'Perfect laptop for work and gaming. M2 chip is incredibly fast.', '2024-01-13 11:20:00', TRUE),
(4, 7, 4, 'Solid laptop, good build quality. Windows 11 works smoothly.', '2024-01-12 09:15:00', TRUE),
(5, 8, 5, 'Great tablet! Perfect for reading and watching videos.', '2024-01-11 13:40:00', TRUE),
(6, 4, 4, 'Comfortable t-shirt, good quality cotton. Fits well.', '2024-01-10 15:25:00', TRUE),
(7, 6, 5, 'Beautiful dress! Perfect for summer events.', '2024-01-09 12:10:00', TRUE),
(8, 10, 4, 'Good winter jacket for kids. Keeps them warm.', '2024-01-08 10:35:00', TRUE),
(9, 9, 5, 'Stunning leather sofa! Very comfortable and looks elegant.', '2024-01-07 14:50:00', TRUE),
(10, 1, 4, 'Durable garden shovel. Good for heavy digging work.', '2024-01-06 16:20:00', TRUE),
(11, 2, 5, 'Classic book, great read. Highly recommended!', '2024-01-05 11:45:00', TRUE),
(12, 3, 4, 'Good Python guide, covers all the basics well.', '2024-01-04 13:30:00', TRUE),
(13, 4, 5, 'Excellent running shoes! Very comfortable for long runs.', '2024-01-03 09:55:00', TRUE),
(14, 5, 4, 'Good yoga mat, nice thickness and grip.', '2024-01-02 15:15:00', TRUE),
(15, 6, 5, 'Great vitamin C supplements. Feel more energetic.', '2024-01-01 12:40:00', TRUE),
(16, 7, 4, 'Nice face cream, skin feels smoother.', '2023-12-31 10:25:00', TRUE),
(17, 8, 5, 'Amazing LEGO set! Great for Star Wars fans.', '2023-12-30 14:10:00', TRUE),
(18, 9, 4, 'Fun board game for family nights.', '2023-12-29 16:35:00', TRUE),
(19, 10, 5, 'Perfect fit for my car. Easy to install.', '2023-12-28 11:50:00', TRUE),
(20, 1, 4, 'Good quality motor oil. Engine runs smoothly.', '2023-12-27 13:25:00', TRUE),
(21, 2, 5, 'Delicious coffee beans! Rich flavor and aroma.', '2023-12-26 09:40:00', TRUE),
(22, 3, 4, 'Great dark chocolate. Not too bitter.', '2023-12-25 15:05:00', TRUE),
(23, 4, 5, 'Beautiful diamond ring! Perfect for engagement.', '2023-12-24 12:30:00', TRUE),
(24, 5, 4, 'Elegant silver necklace. Good quality.', '2023-12-23 10:55:00', TRUE);

-- Update customer statistics
UPDATE customers SET 
    total_orders = (SELECT COUNT(*) FROM orders WHERE customer_id = customers.customer_id),
    total_spent = (SELECT COALESCE(SUM(total_amount), 0) FROM orders WHERE customer_id = customers.customer_id);

-- Create indexes for better performance
CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_supplier ON products(supplier_id);
CREATE INDEX idx_orders_customer ON orders(customer_id);
CREATE INDEX idx_orders_date ON orders(order_date);
CREATE INDEX idx_order_items_order ON order_items(order_id);
CREATE INDEX idx_order_items_product ON order_items(product_id);
CREATE INDEX idx_inventory_product ON inventory(product_id);
CREATE INDEX idx_reviews_product ON product_reviews(product_id);
CREATE INDEX idx_reviews_customer ON product_reviews(customer_id);

-- Create views for common queries
CREATE VIEW product_sales_summary AS
SELECT 
    p.product_id,
    p.name as product_name,
    p.price,
    c.name as category_name,
    s.name as supplier_name,
    i.quantity_in_stock,
    COUNT(oi.order_item_id) as total_orders,
    SUM(oi.quantity) as total_quantity_sold,
    SUM(oi.total_price) as total_revenue,
    AVG(pr.rating) as average_rating,
    COUNT(pr.review_id) as total_reviews
FROM products p
LEFT JOIN categories c ON p.category_id = c.category_id
LEFT JOIN suppliers s ON p.supplier_id = s.supplier_id
LEFT JOIN inventory i ON p.product_id = i.product_id
LEFT JOIN order_items oi ON p.product_id = oi.product_id
LEFT JOIN product_reviews pr ON p.product_id = pr.product_id
GROUP BY p.product_id, p.name, p.price, c.name, s.name, i.quantity_in_stock;

CREATE VIEW customer_order_summary AS
SELECT 
    c.customer_id,
    c.first_name,
    c.last_name,
    c.email,
    COUNT(o.order_id) as total_orders,
    SUM(o.total_amount) as total_spent,
    AVG(o.total_amount) as average_order_value,
    MAX(o.order_date) as last_order_date,
    COUNT(DISTINCT oi.product_id) as unique_products_purchased
FROM customers c
LEFT JOIN orders o ON c.customer_id = o.customer_id
LEFT JOIN order_items oi ON o.order_id = oi.order_id
GROUP BY c.customer_id, c.first_name, c.last_name, c.email;

-- Sample queries for testing RAG system
-- These queries demonstrate the kind of questions users might ask

/*
-- Top selling products
SELECT product_name, total_quantity_sold, total_revenue 
FROM product_sales_summary 
ORDER BY total_quantity_sold DESC 
LIMIT 10;

-- Customer spending analysis
SELECT 
    CASE 
        WHEN total_spent >= 1000 THEN 'High Value'
        WHEN total_spent >= 500 THEN 'Medium Value'
        ELSE 'Low Value'
    END as customer_segment,
    COUNT(*) as customer_count,
    AVG(total_spent) as avg_spending
FROM customer_order_summary 
GROUP BY customer_segment;

-- Inventory analysis
SELECT 
    category_name,
    COUNT(*) as product_count,
    SUM(quantity_in_stock) as total_stock,
    AVG(price) as avg_price
FROM product_sales_summary 
GROUP BY category_name 
ORDER BY total_stock DESC;

-- Revenue by month
SELECT 
    DATE_TRUNC('month', order_date) as month,
    COUNT(*) as order_count,
    SUM(total_amount) as monthly_revenue
FROM orders 
GROUP BY month 
ORDER BY month;
*/

COMMIT;

-- Display summary
SELECT 'Database created successfully!' as status;
SELECT COUNT(*) as total_customers FROM customers;
SELECT COUNT(*) as total_products FROM products;
SELECT COUNT(*) as total_orders FROM orders;
SELECT COUNT(*) as total_reviews FROM product_reviews; 