-- Expense splitting: shares, settlements, and group balances
-- Implements UC#11 (Shared Finances and Payment) from the V2.0 Spec

-- Each row records one member's share of an expense
CREATE TABLE IF NOT EXISTS expense_shares (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    expense_id UUID NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    share_amount NUMERIC(10, 2) NOT NULL,
    split_rule TEXT DEFAULT 'equal',       -- equal | percentage | custom
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_expense_shares_expense ON expense_shares(expense_id);
CREATE INDEX idx_expense_shares_user ON expense_shares(user_id);

-- Prevent duplicate shares for same user on same expense
ALTER TABLE expense_shares
    ADD CONSTRAINT uq_expense_shares_user_expense UNIQUE (expense_id, user_id);

-- Settlements: records when one user pays another to settle debts
CREATE TABLE IF NOT EXISTS settlements (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    trip_id UUID NOT NULL,
    from_user_id UUID NOT NULL,
    to_user_id UUID NOT NULL,
    amount NUMERIC(10, 2) NOT NULL,
    currency TEXT DEFAULT 'USD',
    method TEXT DEFAULT 'manual',          -- manual | stripe | venmo | cash
    note TEXT,
    settled_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_settlements_trip ON settlements(trip_id);
CREATE INDEX idx_settlements_from ON settlements(from_user_id);
CREATE INDEX idx_settlements_to ON settlements(to_user_id);
