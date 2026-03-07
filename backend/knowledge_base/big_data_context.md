# Apache Spark Big Data Engineering Knowledge Base
# Circana — Liquid Data Platform

## Role Context

**Role**: Senior Big Data Engineer / Tech Lead  
**Company**: Circana (formerly IRI + NPD Group)  
**Platform**: Liquid Data — a large-scale CPG/retail analytics system  
**Primary Responsibility**: Design, build, and operate petabyte-scale ETL pipelines that process store-level POS data for CPG clients across North America and Europe.

---

## Technology Stack

### Apache Spark (PySpark + Scala)
- Version landscape: Spark 2.4 (legacy), Spark 3.2–3.5 (current production), Spark 4.x (evaluation)
- Job types: batch ETL, Structured Streaming (low-latency aggregation), Spark SQL
- Key tuning parameters:
  - `spark.executor.memory`, `spark.executor.cores`, `spark.driver.memory`
  - `spark.sql.shuffle.partitions` (target 200–2000 depending on data volume)
  - `spark.sql.adaptive.enabled=true` (AQE — auto-optimises shuffle, skew, coalesce)
  - `spark.sql.adaptive.skewJoin.enabled=true`
  - `spark.broadcast.threshold` (default 10 MB; raise carefully)
  - `spark.memory.offHeap.enabled`, `spark.memory.offHeap.size`
  - `spark.serializer=org.apache.spark.serializer.KryoSerializer`
- Common errors and fixes:
  - **GC overhead / OOM**: increase executor memory, reduce parallelism, use off-heap, avoid collect()
  - **Straggler tasks / data skew**: salting join keys, AQE skew join, repartition(N, col)
  - **Shuffle spill**: increase `spark.executor.memory`, tune shuffle partitions
  - **Broadcast join failures**: reduce broadcast threshold or switch to sort-merge join
  - **Task serialisation errors**: ensure UDFs and closures are serialisable (Kryo)

### Hadoop / HDFS / YARN
- Hadoop version: 3.2–3.3 on-premises clusters
- HDFS:
  - Block size: 128 MB default; 256 MB for large sequential read workloads
  - Replication factor: 3 (production), 1 (scratch/temp)
  - Common issues: under-replicated blocks, NameNode GC pause, safemode
  - CLI: `hdfs dfs -ls`, `hdfs dfsadmin -report`, `hdfs fsck /path`
- YARN:
  - Scheduler: Capacity Scheduler with multiple queues (default, etl, adhoc, reporting)
  - Preemption: enabled for high-priority ETL queues
  - Common issues: queue saturation, AM resource starvation, long GC in NM
  - CLI: `yarn application -list`, `yarn logs -applicationId`, `yarn node -list`

### Apache Hive / HiveQL
- Used for: schema management, partition cataloguing, interactive SQL on HDFS data
- Hive Metastore (HMS): MySQL/PostgreSQL backend, HA config with Thrift server
- File formats: ORC (production), Parquet (interchange), Avro (streaming)
- Partitioning: typically by `year/month/day` or `client_id/date`
- Common issues:
  - HMS lock contention (LOCK TABLE conflicts in concurrent writes)
  - Schema evolution with Avro (registry required)
  - `MSCK REPAIR TABLE` needed after manual HDFS writes
  - Partition pruning not working: check predicate push-down, stats freshness (`ANALYZE TABLE`)
- Key DDL patterns:
  ```sql
  ALTER TABLE db.table ADD PARTITION (dt='2024-01-01') LOCATION 'hdfs://...';
  MSCK REPAIR TABLE db.table;
  ANALYZE TABLE db.table COMPUTE STATISTICS FOR COLUMNS col1, col2;
  ```

### Azure Data Lake Storage Gen2 (ADLS)
- Used for: cloud landing zone, archival, cross-region replication
- Authentication: Service Principal with OAuth 2.0, Managed Identity in ADF
- ACLs: POSIX-style on directories; best practice — coarse-grained ACLs at container level
- Common issues:
  - Throttling (429): exponential back-off, reduce concurrency, request rate tuning
  - Permission denied: check ACL inheritance, service principal role assignment (Storage Blob Data Contributor)
  - Concurrent write conflicts: use write-then-rename pattern or Azure Blob lease
- Mounting: via `abfss://` in Spark config or Databricks DBFS mount
- Lifecycle policies: hot → cool after 30 days, delete after 365 days (configurable per container)

### Microsoft SQL Server
- Used for: operational metadata store, client configuration tables, reporting layer
- Versions: SQL Server 2016–2022
- Integration patterns: Spark-JDBC (`spark.read.jdbc`), SSIS packages, linked-server queries
- Tuning: columnstore indexes for analytical queries, row-level security for multi-client tables
- Common issues: JDBC connection pool exhaustion, query plan regression after stats update

---

## ETL Pipeline Architecture

### General Pattern
```
Ingestion (raw files: CSV, Parquet, ORC)
  → Landing Zone (ADLS or HDFS /landing)
    → Validation & Dedup (Spark)
      → Staging (Hive external tables on HDFS /staging)
        → Transformation & Aggregation (Spark)
          → Curated / Warehouse Layer (Hive managed tables, ORC partitioned)
            → Serving Layer (SQL Server or Liquid Data API)
```

### SLA-Driven Production Pipelines
- Pipelines have hard SLAs (e.g., "Complete Store daily file must be available by 06:00 ET")
- Dependencies tracked via Oozie coordinator or ADF triggers
- Retry logic: 3 attempts with exponential back-off before PagerDuty alert
- SLA monitoring: Grafana dashboard + email/Slack alerts at T-30 min warning

### Common Pipeline Types
1. **Daily POS Ingestion**: ingest 200–500 GB of store-level POS files from 50+ retailers
2. **Store Aggregation**: aggregate SKU-level scan data to store/week/category/client hierarchies
3. **Complete Store Expansion**: statistical model application to estimate unmeasured distribution
4. **Client Data Delivery**: slice/filter/format data per client SLA and delivery channel
5. **Reference Data Sync**: sync product hierarchy, store master, calendar tables from SQL Server → Hive

### Concurrent Job Scheduling & Tuning
- Maximum 8 concurrent Spark applications on primary cluster
- Queue priorities: etl-critical > etl-standard > reporting > adhoc
- Memory allocation: 24 GB executor memory for large joins; 8 GB for light transforms
- Dynamic allocation: enabled for reporting jobs; disabled for ETL (predictable resource planning)

---

## Data Warehousing Patterns

### Partitioning Strategy
- Fact tables: partition by `(year, month, day)` or `(client_id, week_ending_date)`
- Dimension tables: no partitioning (small, full-reload nightly)
- Over-partitioning risk: avoid partitions < 128 MB (causes small-file problem)

### Data Quality Framework
- Row-count reconciliation between source and target at each stage
- Null-check, referential integrity, and range validation via Great Expectations or custom PySpark assertions
- Quarantine pattern: invalid records written to `/quarantine` with error metadata

### Slowly Changing Dimensions (SCD)
- Type 1: overwrite (product descriptions, store attributes)
- Type 2: effective date ranges (client hierarchy changes)
- Implemented via Spark merge-into (Delta Lake) or CASE WHEN / INSERT OVERWRITE in Hive

---

## Circana / Liquid Data Platform Context

### Business Context
- Circana provides CPG manufacturers and retailers with consumer insights and market intelligence
- Liquid Data is the SaaS analytics platform delivering these insights
- Key products: Complete Store, Liquid Data Discover, Unify (cross-retailer benchmarking)
- Clients include top-10 CPG companies (food, beverage, HPC, OTC pharma)

### Data Scale
- ~500 TB active data under management
- ~2 billion POS scan records processed weekly
- 300+ active ETL jobs across production clusters
- 50+ retail data suppliers with varying file formats and delivery schedules

### Operational Cadence
- **Daily**: POS ingestion, store aggregation, client delivery jobs
- **Weekly**: complete store expansion model run, hierarchy sync
- **Monthly**: production review meeting, capacity planning review
- **Quarterly**: platform version upgrade planning, new client onboarding

### Key Teams
- **Data Engineering**: pipeline development and operations (this role)
- **Data Science**: model development (Complete Store expansion, forecasting)
- **Platform / Infra**: Hadoop cluster operations, ADLS management
- **Client Services**: SLA reporting, client escalations
- **Product**: Liquid Data feature roadmap

---

## Incident Response Playbook

### P1 — Production SLA at Risk
1. Check YARN Resource Manager UI for queue saturation
2. Run `yarn application -list -appStates RUNNING` to identify competing jobs
3. Check `spark.sql.shuffle.partitions` and executor logs for OOM/GC
4. Review HDFS NameNode logs for safemode or block issues
5. Escalate to Platform team if cluster-level issue
6. Notify Client Services if SLA breach is imminent (T-30 min)

### P2 — Job Failed, Retry In Progress
1. Check Spark History Server for failed stage details
2. Review executor stderr for root cause (OOM, timeout, serialisation)
3. Adjust job config if needed (memory, partitions, broadcast threshold)
4. Re-submit with `--conf` overrides if immediate fix needed

### Common Resolution Commands
```bash
# Check YARN queue status
yarn schedulerconf

# Kill a specific application
yarn application -kill application_XXXXXXXXXX_XXXX

# Check HDFS health
hdfs dfsadmin -report
hdfs fsck / -summary

# Recover HMS partitions
hive -e "MSCK REPAIR TABLE db.table_name;"

# Check Spark application logs
yarn logs -applicationId application_XXXXXXXXXX_XXXX -log_files stderr
```

---

## Best Practices Checklist

### Before Deploying a New Pipeline
- [ ] Estimated data volume and growth rate documented
- [ ] Partitioning strategy reviewed
- [ ] SLA agreed with client services
- [ ] Retry and alerting logic configured
- [ ] Runbook entry created
- [ ] Performance tested on 3-month backfill

### Spark Job Hardening
- [ ] AQE enabled (`spark.sql.adaptive.enabled=true`)
- [ ] Skew join detection enabled
- [ ] Off-heap configured for shuffle-heavy jobs
- [ ] Kryo serialiser configured
- [ ] Dynamic allocation disabled for SLA-critical jobs
- [ ] Driver memory sized appropriately (no collect() on large datasets)

### Hive Table Hardening
- [ ] Statistics computed after initial load (`ANALYZE TABLE`)
- [ ] Partition pruning tested with EXPLAIN EXTENDED
- [ ] Small-file compaction scheduled (INSERT OVERWRITE with coalesce)
- [ ] HMS backup verified
