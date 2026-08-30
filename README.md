# PropertyVerify - Property Data Verification & Enrichment System

PropertyVerify is a backend service for managing the verification and enrichment of residential property records. It provides secure Admin, Data Checker, and Reviewer workflows for assignment management, property verification, review, approval, audit tracking, and background processing.

---

## Project Demo

### Demo Video

[▶️ Watch the Project Demo](YOUR_VIDEO_LINK_HERE)

The demo covers:

- JWT authentication and role-based authorization
- Admin assignment creation
- Data Checker assignment claiming
- Property verification and updates
- Reviewer approval workflow
- Master property updates
- Audit history
- BullMQ and Redis background processing
- Swagger API documentation
- Pagination and filtering
- Database and scalability considerations

---

# Tech Stack
## Backend
- NestJS
- TypeScript
- REST APIs
## Database
- PostgreSQL
- Drizzle ORM
## Authentication
- JWT
- Passport
- bcrypt
- Role-Based Access Control
## Background Processing
- BullMQ
- Redis
- ioredis
## Validation & Testing
- class-validator
- Jest
- Supertest
## API Documentation
- Swagger / OpenAPI
## Infrastructure
- Docker
- Docker Compose

---

## Features

### Authentication & Authorization

- JWT authentication
- Role-Based Access Control (RBAC)
- Admin, Data Checker, and Reviewer roles
- Protected REST APIs
- Password hashing with bcrypt
- Request validation with `class-validator`

### Admin

- Create verification assignments
- Assign multiple properties
- View assignments and assignment details
- Pagination and status filtering
- Assignment statistics
- Completion time estimation

### Data Checker

- Claim open assignments
- Atomic assignment claiming
- Start assignments
- View assigned properties
- Propose property updates
- Track changed fields
- Submit assignments for review
- Prevent modification after submission

### Reviewer

- View pending reviews
- View review details
- Compare original and proposed values
- Approve changes
- Reject changes
- Return changes for correction
- Add reviewer notes
- Prevent duplicate review decisions
- Update master property data only after approval

### Audit History

Every property modification records:

- User
- Timestamp
- Changed fields
- Old values
- New values

### Background Processing

BullMQ and Redis handle asynchronous processing for:

- Assignment statistics
- Completion time estimation
- Property search/verification
- Confidence score generation

---

###  Architecture

The application follows a layered NestJS architecture separating controllers, business services, authentication, database access, queues, workers, and review workflows.

---

### Database Design

Main entities:

- Users
- Properties
- Assignments
- Assignment Properties
- Property Reviews
- Audit Logs

The properties table contains the latest approved property information.

Checker changes are stored separately as review proposals containing the original and proposed values. The master property is updated only after reviewer approval.

This prevents unapproved changes from directly modifying master data.

---
### Business Rules

- Only Admin users can create assignments.
- Only Data Checkers can claim assignments.
- An assignment can only be claimed once.
- Assignment claiming is atomic to prevent race conditions.
- Only the assigned checker can work on an assignment.
- Submitted and completed assignments cannot be modified by the checker.
- Reviewers can approve, reject, or return proposed changes.
- A review cannot be approved or rejected twice.
- The master property is updated only after approval.
- Rejected changes do not modify the master property.
- Property modifications are recorded in audit history.
- Business-critical writes use database transactions where appropriate.

---
### Scalability

The system is designed with 1M+ property records in mind.

- Database-side pagination and filtering
- Indexing for frequently queried fields
- PostgreSQL for relational data
- Connection pooling
- Separate master and audit data
- Potential partitioning for large audit tables
- Background Processing

Verification work is handled asynchronously using BullMQ and Redis rather than blocking API requests.

Workers can be scaled independently as workload increases.

For a larger production deployment, database replicas, partitioning, caching, monitoring, and additional queue workers could be introduced based on actual workload requirements.

---

### Key Engineering Decisions

- Master property data is isolated from proposed changes.
- Reviewer approval is required before updating master data.
- Original and proposed values are preserved during review.
- Audit history provides a complete change trail.
- Assignment claiming is protected against concurrent claims.
- Background processing is separated from synchronous API operations.
- JWT and role guards provide centralized access control.
- Pagination prevents unbounded data retrieval.
- BullMQ workers can scale independently.
- Transactions are used where consistency across multiple writes is required.

---

### Author

## Ayesha Ansari

## Backend Developer Assignment - Property Data Verification & Enrichment System