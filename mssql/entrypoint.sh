#!/bin/bash
set -e

# Detect sqlcmd path (varies between mssql-server and azure-sql-edge images)
if [ -x /opt/mssql-tools18/bin/sqlcmd ]; then
    SQLCMD="/opt/mssql-tools18/bin/sqlcmd -No"
elif [ -x /opt/mssql-tools/bin/sqlcmd ]; then
    SQLCMD="/opt/mssql-tools/bin/sqlcmd"
else
    echo "[mssql-init] ERROR: sqlcmd not found" && exit 1
fi

# Start SQL Server in the background
/opt/mssql/bin/sqlservr &
MSSQL_PID=$!

echo "[mssql-init] Waiting for SQL Server to become ready..."
for i in $(seq 1 60); do
    $SQLCMD -S localhost -U sa -P "$MSSQL_SA_PASSWORD" \
        -Q "SELECT 1" > /dev/null 2>&1 && break
    sleep 2
done

# Create database
echo "[mssql-init] Creating database academics..."
$SQLCMD -S localhost -U sa -P "$MSSQL_SA_PASSWORD" \
    -Q "IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = N'academics') CREATE DATABASE academics"

# Create application login academics/academicspwd (consistent with compsci/mathsci pattern)
echo "[mssql-init] Creating login ${MSSQL_USER}..."
$SQLCMD -S localhost -U sa -P "$MSSQL_SA_PASSWORD" -Q "
IF NOT EXISTS (SELECT name FROM sys.server_principals WHERE name = N'${MSSQL_USER}')
    CREATE LOGIN [${MSSQL_USER}] WITH PASSWORD = N'${MSSQL_PASSWORD}', CHECK_POLICY = OFF;
"

$SQLCMD -S localhost -U sa -P "$MSSQL_SA_PASSWORD" -d academics -Q "
IF NOT EXISTS (SELECT name FROM sys.database_principals WHERE name = N'${MSSQL_USER}')
    CREATE USER [${MSSQL_USER}] FOR LOGIN [${MSSQL_USER}];
ALTER ROLE db_owner ADD MEMBER [${MSSQL_USER}];
"

# Run init script
echo "[mssql-init] Running academics.sql..."
$SQLCMD -S localhost -U sa -P "$MSSQL_SA_PASSWORD" \
    -d academics -i /docker-entrypoint-initdb.d/academics.sql

echo "[mssql-init] Initialization complete."

# Keep SQL Server running in the foreground
wait $MSSQL_PID
