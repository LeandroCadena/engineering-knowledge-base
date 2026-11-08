CREATE TABLE inventory (
  sku text PRIMARY KEY,
  stock integer NOT NULL CHECK (stock >= 0)
);
CREATE TABLE orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_key text NOT NULL UNIQUE,
  sku text NOT NULL REFERENCES inventory(sku),
  quantity integer NOT NULL CHECK (quantity > 0),
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX orders_sku_recent_idx ON orders (sku, created_at DESC, id DESC);
