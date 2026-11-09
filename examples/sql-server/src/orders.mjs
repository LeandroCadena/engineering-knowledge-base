import sql from 'mssql';
export function repository(pool) {
  return {
    async create(tenant, key, amountCents) {
      return (
        await pool
          .request()
          .input('tenant', sql.NVarChar(40), tenant)
          .input('key', sql.NVarChar(80), key)
          .input('amount', sql.Int, amountCents).query(`
          SET XACT_ABORT ON;
          BEGIN TRY
            BEGIN TRANSACTION;
            DECLARE @id int, @stored int;
            SELECT @id=id, @stored=amount_cents FROM dbo.Orders WITH (UPDLOCK, HOLDLOCK)
              WHERE tenant_id=@tenant AND idempotency_key=@key;
            IF @id IS NOT NULL
            BEGIN
              IF @stored<>@amount THROW 50001, 'Idempotency payload conflict', 1;
              COMMIT;
              SELECT @id AS id, CAST(1 AS bit) AS replayed;
              RETURN;
            END;
            INSERT dbo.Orders(tenant_id,idempotency_key,amount_cents) VALUES(@tenant,@key,@amount);
            SET @id=CONVERT(int,SCOPE_IDENTITY());
            INSERT dbo.Outbox(order_id,event_type) VALUES(@id,N'OrderCreated');
            COMMIT;
            SELECT @id AS id, CAST(0 AS bit) AS replayed;
          END TRY
          BEGIN CATCH
            IF @@TRANCOUNT>0 ROLLBACK;
            THROW;
          END CATCH;
        `)
      ).recordset[0];
    },
    async get(tenant, id) {
      return (
        (
          await pool
            .request()
            .input('tenant', sql.NVarChar(40), tenant)
            .input('id', sql.Int, id)
            .query(
              'SELECT id,amount_cents,status,version FROM dbo.Orders WHERE tenant_id=@tenant AND id=@id',
            )
        ).recordset[0] ?? null
      );
    },
    async confirm(tenant, id, expectedVersion) {
      const r = await pool
        .request()
        .input('tenant', sql.NVarChar(40), tenant)
        .input('id', sql.Int, id)
        .input('version', sql.Binary(8), expectedVersion)
        .query(`UPDATE dbo.Orders SET status=N'confirmed' OUTPUT inserted.version
          WHERE tenant_id=@tenant AND id=@id AND version=@version AND status=N'pending'`);
      return r.recordset[0]?.version ?? null;
    },
  };
}
