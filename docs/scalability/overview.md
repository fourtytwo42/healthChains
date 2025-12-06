# Scalability Overview

This document covers scalability considerations, limitations, and strategies for HealthChains.

## Current Architecture

### On-Chain Storage

**What's Stored**:
- Consent records (minimal metadata)
- Access requests
- Event logs (for audit trail)

**What's NOT Stored**:
- Actual medical data (stored off-chain)
- Patient/provider names (only addresses on-chain)
- Large datasets

**Rationale**: Keep on-chain storage minimal to reduce gas costs and improve scalability.

### Off-Chain Storage

**What's Stored**:
- Patient/provider metadata (names, demographics)
- Medical records (history, lab results, imaging)
- Event indexes (for efficient querying)

**Rationale**: Medical data is too large and expensive for blockchain storage.

## Current Limitations

### Blockchain Throughput

**Ethereum Mainnet**: ~15 transactions per second
- **Impact**: High gas costs, slow confirmation times
- **Solution**: Layer 2 solutions (Polygon, Arbitrum, Optimism)

**Hardhat Local**: Unlimited (for development)
- **Impact**: Fast and free in development
- **Solution**: Not applicable (development only)

### Gas Costs

**Mainnet Gas Prices**: Variable, often high ($10-100+ per transaction)
- **Impact**: Expensive to use at scale
- **Solution**: Layer 2 solutions reduce costs by 10-100x

**Current Optimizations**:
- Batch operations reduce transaction count
- Hash storage reduces data size
- Struct packing minimizes storage slots
- Custom errors reduce revert costs

### Query Performance

**On-Chain Queries**: Can be slow for complex queries
- **Impact**: User experience degradation
- **Solution**: Off-chain indexing and caching

**Off-Chain Indexes**: Fast but requires maintenance
- **Impact**: Additional infrastructure needed
- **Solution**: Current architecture uses backend indexing

## Scaling Strategies

### 1. Layer 2 Solutions

**Polygon**: 
- Throughput: ~7,000 TPS
- Gas costs: ~0.001 MATIC per transaction
- Migration: Deploy contract to Polygon

**Arbitrum**:
- Throughput: High (limited by sequencer)
- Gas costs: ~$0.10-1 per transaction
- Migration: Deploy contract to Arbitrum

**Optimism**:
- Throughput: High
- Gas costs: ~$0.10-1 per transaction
- Migration: Deploy contract to Optimism

**Benefits**:
- 10-100x lower gas costs
- Faster transaction confirmation
- Same security guarantees (inherited from Ethereum)

**Trade-offs**:
- Requires bridge for mainnet assets
- Different network infrastructure
- Additional deployment steps

### 2. Off-Chain Indexing

**Current Implementation**: Backend indexes events

**Scalability Improvements**:
- Database indexing (PostgreSQL, MongoDB)
- Event processing queue (Redis, RabbitMQ)
- Distributed indexing (multiple backend instances)

**Benefits**:
- Fast queries (milliseconds vs seconds)
- Complex filtering and sorting
- Pagination support

**Trade-offs**:
- Additional infrastructure
- Requires synchronization with blockchain
- Potential for indexer lag

### 3. Caching

**Current Implementation**: React Query caching in frontend

**Scalability Improvements**:
- Backend caching (Redis)
- CDN for static assets
- Browser caching

**Benefits**:
- Reduced API load
- Faster response times
- Better user experience

**Trade-offs**:
- Cache invalidation complexity
- Stale data risks
- Memory usage

### 4. Database Optimization

**Current Implementation**: In-memory mockup data

**Scalability Improvements**:
- PostgreSQL for structured data
- Indexes on frequently queried fields
- Connection pooling
- Read replicas

**Benefits**:
- Persistent storage
- Better query performance
- Horizontal scaling

**Trade-offs**:
- Database setup and maintenance
- Additional infrastructure
- Backup and recovery

### 5. Pagination

**Current Implementation**: Some endpoints return all data

**Scalability Improvements**:
- Pagination on all list endpoints
- Cursor-based pagination
- Limit maximum page size

**Benefits**:
- Reduced response size
- Faster queries
- Better mobile experience

**Trade-offs**:
- More complex frontend logic
- Additional API parameters

### 6. Batch Operations

**Current Implementation**: Batch consent and request operations

**Scalability Improvements**:
- Increase MAX_BATCH_SIZE (if safe)
- Batch multiple operations in one transaction
- Aggressive batching in frontend

**Benefits**:
- Fewer transactions
- Lower gas costs
- Better throughput

**Trade-offs**:
- Larger transaction payloads
- More complex validation
- Gas limit considerations

## Performance Metrics

### Current Performance

**Smart Contract**:
- Grant Consent: ~320,000 gas
- Batch Grant (10): ~2,000,000 gas (200,000 per consent)
- Revoke Consent: ~45,000 gas
- Request Access: ~180,000 gas (varies by array sizes)

**Backend API**:
- Health Check: <10ms
- Get Patients: <50ms
- Get Consents: <100ms (event query)
- Event Query: <200ms

**Frontend**:
- Page Load: <2s (development)
- API Calls: <500ms (cached)
- Transaction Confirmation: 1-2s (Hardhat), 10-60s (Mainnet)

### Target Performance

**Smart Contract** (Layer 2):
- Grant Consent: <$0.10
- Batch Grant: <$1.00
- Transaction Confirmation: <5s

**Backend API**:
- All endpoints: <100ms (95th percentile)
- Event queries: <200ms
- Database queries: <50ms

**Frontend**:
- Page Load: <1s
- API Calls: <200ms
- Smooth interactions: 60fps

## Scalability Roadmap

### Phase 1: Current (MVP)

- ✅ Batch operations
- ✅ Event-based queries
- ✅ Off-chain indexing
- ✅ Gas optimizations

### Phase 2: Database & Caching

- [ ] PostgreSQL database
- [ ] Redis caching
- [ ] Connection pooling
- [ ] Database indexes

### Phase 3: Layer 2 Migration

- [ ] Deploy to Polygon/Arbitrum
- [ ] Update frontend configuration
- [ ] Bridge setup (if needed)
- [ ] User migration guide

### Phase 4: Advanced Optimization

- [ ] Pagination on all endpoints
- [ ] GraphQL API (optional)
- [ ] CDN integration
- [ ] Load balancing

### Phase 5: Distributed Architecture

- [ ] Multiple backend instances
- [ ] Distributed event indexing
- [ ] Database replication
- [ ] Global CDN

## Monitoring & Metrics

### Key Metrics to Monitor

**Blockchain**:
- Transaction confirmation time
- Gas costs
- Transaction failure rate
- Network congestion

**Backend**:
- API response times
- Error rates
- Database query performance
- Event indexing lag

**Frontend**:
- Page load times
- API call latency
- Transaction success rate
- User engagement

### Monitoring Tools

**Blockchain**:
- Etherscan/Polygonscan
- Gas tracking tools
- Network status dashboards

**Backend**:
- Application Performance Monitoring (APM)
- Log aggregation (ELK, Splunk)
- Metrics (Prometheus, Grafana)

**Frontend**:
- Real User Monitoring (RUM)
- Error tracking (Sentry)
- Analytics (Google Analytics)

## Capacity Planning

### Expected Load

**Patients**: 1,000 - 10,000
**Providers**: 100 - 1,000
**Consents per Patient**: 5 - 20
**Requests per Day**: 100 - 1,000

### Infrastructure Requirements

**Development**:
- Single server
- Local blockchain
- No scaling needed

**Production (Small)**:
- 1-2 backend instances
- PostgreSQL database
- Redis cache
- Layer 2 blockchain

**Production (Large)**:
- Multiple backend instances
- Database cluster
- Distributed cache
- Load balancer
- CDN

## Related Documentation

- [Gas Optimization](gas-optimization.md) - Contract gas optimization
- [Performance](performance.md) - Performance tuning guide
- [Limitations](limitations.md) - Current limitations and workarounds

