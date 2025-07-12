-- Drop tables if they exist
DROP TABLE IF EXISTS payments;
DROP TABLE IF EXISTS sales;
DROP TABLE IF EXISTS reviews;
DROP TABLE IF EXISTS stock;
DROP TABLE IF EXISTS products;
DROP TABLE IF EXISTS categories;
DROP TABLE IF EXISTS suppliers;

-- Categories
CREATE TABLE categories (
  category_id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL
);

-- Suppliers
CREATE TABLE suppliers (
  supplier_id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  contact_info VARCHAR(255)
);

-- Products
CREATE TABLE products (
  product_id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  sku VARCHAR(50),
  category_id INT,
  supplier_id INT,
  price DECIMAL(10,2),
  cost_price DECIMAL(10,2),
  weight DECIMAL(10,2),
  dimensions VARCHAR(50),
  expiry DATE,
  is_active BOOLEAN DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (category_id) REFERENCES categories(category_id),
  FOREIGN KEY (supplier_id) REFERENCES suppliers(supplier_id)
);

-- Stock movements
CREATE TABLE stock (
  stock_id INT AUTO_INCREMENT PRIMARY KEY,
  product_id INT,
  `change` INT,
  change_date DATETIME,
  reason VARCHAR(100),
  FOREIGN KEY (product_id) REFERENCES products(product_id)
);

-- Sales
CREATE TABLE sales (
  sale_id INT AUTO_INCREMENT PRIMARY KEY,
  product_id INT,
  quantity INT,
  sale_date DATETIME,
  price DECIMAL(10,2),
  FOREIGN KEY (product_id) REFERENCES products(product_id)
);

-- Payments
CREATE TABLE payments (
  payment_id INT AUTO_INCREMENT PRIMARY KEY,
  sale_id INT,
  amount DECIMAL(10,2),
  payment_date DATETIME,
  method VARCHAR(50),
  FOREIGN KEY (sale_id) REFERENCES sales(sale_id)
);

-- Reviews
CREATE TABLE reviews (
  review_id INT AUTO_INCREMENT PRIMARY KEY,
  product_id INT,
  rating INT,
  review_text TEXT,
  review_date DATETIME,
  FOREIGN KEY (product_id) REFERENCES products(product_id)
);

-- Populate categories
INSERT INTO categories (name) VALUES
('Smartphones'), ('Laptops'), ('Tablets'), ('Clothing'), ('Furniture'), ('Toys'), ('Books'), ('Automotive'), ('Food'), ('Jewelry');

-- Populate suppliers
INSERT INTO suppliers (name, contact_info) VALUES
('Apple Inc.', 'apple@example.com'),
('Samsung Electronics', 'samsung@example.com'),
('Dell', 'dell@example.com'),
('IKEA', 'ikea@example.com'),
('Nike', 'nike@example.com'),
('LEGO', 'lego@example.com'),
('Penguin Books', 'penguin@example.com'),
('Bosch', 'bosch@example.com'),
('Starbucks', 'starbucks@example.com'),
('Tiffany & Co.', 'tiffany@example.com');

-- Populate products (varied for analytics)
INSERT INTO products (name, description, sku, category_id, supplier_id, price, cost_price, weight, dimensions, expiry, is_active, created_at, updated_at) VALUES
('iPhone 15 Pro', 'Latest Apple smartphone', 'IPH15PRO-128', 1, 1, 999.99, 650.00, 0.50, '6.1x3.0x0.3', '2025-12-31', 1, '2024-05-01', '2024-07-01'),
('Samsung Galaxy S24', 'Premium Android smartphone', 'SAMS24-256', 1, 2, 899.99, 580.00, 0.48, '6.2x3.0x0.3', '2025-12-31', 1, '2024-05-01', '2024-07-01'),
('MacBook Air M2', 'Lightweight laptop with M2 chip', 'MBA-M2-13', 2, 1, 1199.99, 800.00, 2.70, '12.0x8.5x0.6', '2026-12-31', 1, '2024-05-01', '2024-07-01'),
('Old Stock Pen', 'Pen stuck in inventory', 'PEN-001', 4, 5, 1.50, 1.00, 0.02, '5.0x0.5x0.5', '2024-07-01', 1, '2023-01-01', '2024-07-01'),
('Expired Milk', 'Milk past expiry', 'MLK-EXP-01', 9, 9, 2.50, 2.00, 1.00, '2x2x6', '2024-06-01', 1, '2024-04-01', '2024-07-01'),
('Loss Leader Widget', 'Widget sold at a loss', 'WIDG-LOSS', 6, 6, 5.00, 7.00, 0.10, '2x2x2', '2025-12-31', 1, '2024-05-01', '2024-07-01'),
('Popular Headphones', 'Best selling headphones', 'HPH-POP', 1, 2, 50.00, 30.00, 0.30, '7x6x3', '2026-12-31', 1, '2024-05-01', '2024-07-01'),
('Dead Stock Toy', 'Toy not selling for a year', 'TOY-DS-01', 6, 6, 20.00, 10.00, 0.50, '8x6x4', '2026-12-31', 1, '2023-01-01', '2024-07-01'),
('Fresh Bread', 'Bread with short expiry', 'BRD-FRESH', 9, 9, 1.00, 0.50, 0.30, '6x4x2', '2024-07-10', 1, '2024-07-01', '2024-07-01'),
('Diamond Ring', 'Luxury jewelry', 'JWL-DIA-RNG', 10, 10, 2999.99, 1500.00, 0.10, 'Ring size 7', '2027-12-31', 1, '2024-05-01', '2024-07-01');

-- Stock movements (simulate dead stock, low stock, etc.)
INSERT INTO stock (product_id, `change`, change_date, reason) VALUES
(4, 100, '2023-01-01', 'Initial stock'), -- Old Stock Pen
(4, 0, '2024-07-01', 'No sales for 1.5 years'),
(8, 50, '2023-01-01', 'Initial stock'), -- Dead Stock Toy
(8, 0, '2024-07-01', 'No sales for 1.5 years'),
(1, 10, '2024-05-01', 'Initial stock'), -- iPhone 15 Pro
(2, 10, '2024-05-01', 'Initial stock'),
(3, 5, '2024-05-01', 'Initial stock'),
(5, 20, '2024-04-01', 'Initial stock'), -- Expired Milk
(6, 30, '2024-05-01', 'Initial stock'), -- Loss Leader Widget
(7, 100, '2024-05-01', 'Initial stock'), -- Popular Headphones
(9, 50, '2024-07-01', 'Initial stock'), -- Fresh Bread
(10, 5, '2024-05-01', 'Initial stock'); -- Diamond Ring

-- Sales (simulate low sales, dead stock, expired, loss, best performer)
INSERT INTO sales (product_id, quantity, sale_date, price) VALUES
(1, 2, '2024-07-01', 999.99), -- iPhone 15 Pro (low sales)
(2, 1, '2024-07-01', 899.99), -- Samsung Galaxy S24 (low sales)
(3, 100, '2024-07-01', 1199.99), -- MacBook Air M2 (best performer)
(4, 0, '2024-07-01', 1.50), -- Old Stock Pen (dead stock)
(5, 5, '2024-06-01', 2.50), -- Expired Milk (expired)
(6, 50, '2024-07-01', 5.00), -- Loss Leader Widget (loss)
(7, 200, '2024-07-01', 50.00), -- Popular Headphones (best performer)
(8, 0, '2024-07-01', 20.00), -- Dead Stock Toy (dead stock)
(9, 10, '2024-07-01', 1.00), -- Fresh Bread (low sales, short expiry)
(10, 1, '2024-07-01', 2999.99); -- Diamond Ring

-- Payments
INSERT INTO payments (sale_id, amount, payment_date, method) VALUES
(1, 1999.98, '2024-07-01', 'Credit Card'),
(2, 899.99, '2024-07-01', 'Credit Card'),
(3, 119999.00, '2024-07-01', 'Bank Transfer'),
(5, 12.50, '2024-06-01', 'Cash'),
(6, 250.00, '2024-07-01', 'Credit Card'),
(7, 10000.00, '2024-07-01', 'Credit Card'),
(9, 10.00, '2024-07-01', 'Cash'),
(10, 2999.99, '2024-07-01', 'Credit Card');

-- Reviews
INSERT INTO reviews (product_id, rating, review_text, review_date) VALUES
(1, 5, 'Amazing phone!', '2024-07-01'),
(2, 4, 'Great Android device.', '2024-07-01'),
(3, 5, 'Superb laptop.', '2024-07-01'),
(4, 1, 'Never sells.', '2024-07-01'),
(5, 2, 'Expired quickly.', '2024-06-01'),
(6, 3, 'Cheap but not profitable.', '2024-07-01'),
(7, 5, 'Best headphones ever.', '2024-07-01'),
(8, 1, 'No one buys this toy.', '2024-07-01'),
(9, 4, 'Fresh and tasty.', '2024-07-01'),
(10, 5, 'Beautiful ring.', '2024-07-01'); 