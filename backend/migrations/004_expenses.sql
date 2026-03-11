-- Expenses table for storing parsed receipt data from Vision Model
CREATE TABLE IF NOT EXISTS expenses (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    merchant_name TEXT,
    date DATE,
    items JSONB,
    subtotal NUMERIC(10, 2),
    tax NUMERIC(10, 2),
    tip NUMERIC(10, 2),
    total NUMERIC(10, 2),
    currency TEXT DEFAULT 'USD',
    payment_method TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_expenses_user_id ON expenses(user_id);
