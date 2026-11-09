CREATE TABLE dbo.Orders (
  id int IDENTITY(1,1) NOT NULL CONSTRAINT PK_Orders PRIMARY KEY,
  tenant_id nvarchar(40) COLLATE Latin1_General_100_BIN2 NOT NULL,
  idempotency_key nvarchar(80) COLLATE Latin1_General_100_BIN2 NOT NULL,
  amount_cents int NOT NULL CONSTRAINT CK_Orders_Amount CHECK (amount_cents > 0),
  status nvarchar(16) NOT NULL CONSTRAINT DF_Orders_Status DEFAULT N'pending',
  version rowversion NOT NULL,
  CONSTRAINT UQ_Orders_Request UNIQUE (tenant_id, idempotency_key),
  CONSTRAINT CK_Orders_Status CHECK (status IN (N'pending', N'confirmed'))
);
CREATE TABLE dbo.Outbox (
  id bigint IDENTITY(1,1) NOT NULL CONSTRAINT PK_Outbox PRIMARY KEY,
  order_id int NOT NULL CONSTRAINT FK_Outbox_Order REFERENCES dbo.Orders(id),
  event_type nvarchar(40) NOT NULL,
  CONSTRAINT UQ_Outbox_Order UNIQUE(order_id)
);
