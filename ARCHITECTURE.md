# Industry Standard Microservice Folder Structure

## Current Structure

```
src/
├── main.ts                               # Application bootstrap
├── app.module.ts                        # Root module configuration
├── config/
│   └── configuration.ts                 # Configuration factory
├── domain/                              # Business logic layer
│   ├── entities/
│   │   └── user.entity.ts              # Domain entities (business objects)
│   ├── interfaces/
│   │   └── user.interface.ts           # Repository interfaces
│   └── services/
│       └── user.service.ts             # Domain services (business logic)
├── application/                         # Application layer (use cases)
│   ├── dto/
│   │   └── create-user.dto.ts          # Data transfer objects
│   └── use-cases/
│       └── create-user.use-case.ts     # Application use cases
├── infrastructure/                      # External concerns layer
│   └── database/
│       ├── repositories/
│       │   └── supabase-user.repository.ts # Database-specific implementations (Supabase)
│       └── schemas/
│           └── user.schema.ts          # Database schemas
├── presentation/                        # Presentation layer
│   └── controllers/
│       └── users.controller.ts         # HTTP controllers
├── modules/
│   ├── users/
│   │   └── users.module.ts             # Feature modules
│   └── auth/
│       ├── auth.module.ts
│       ├── auth.controller.ts
│       ├── auth.service.ts
│       └── strategies/
│           ├── google.strategy.ts
│           └── azure.strategy.ts
└── common/                              # Shared components
    ├── guards/
    │   └── roles.guard.ts
    └── decorators/
        └── roles.decorator.ts
```

## Layer Responsibilities

### Domain Layer (`src/domain/`)
- **Entities**: Core business objects with business logic
- **Interfaces**: Contracts for external dependencies
- **Services**: Domain services containing business rules
- **No dependencies** on external frameworks (pure business logic)

### Application Layer (`src/application/`)
- **Use Cases**: Orchestrate domain objects to fulfill application requirements
- **DTOs**: Data contracts for API boundaries
- **Depends only** on domain layer

### Infrastructure Layer (`src/infrastructure/`)
- **Repositories**: Database implementations
- **Schemas**: Database-specific models
- **External services**: Third-party integrations
- **Implements** domain interfaces

### Presentation Layer (`src/presentation/`)
- **Controllers**: HTTP endpoints and request handling
- **Guards**: Authentication and authorization
- **Interceptors**: Cross-cutting concerns (logging, caching)

### Modules (`src/modules/`)
- **Feature modules**: Wire together layers for specific features
- **Dependency injection**: Configure providers and their relationships

## Benefits

1. **Clean Architecture**: Clear separation of concerns
2. **Testability**: Easy to mock dependencies at boundaries
3. **Maintainability**: Changes in one layer don't affect others
4. **Scalability**: Easy to add new features following the same pattern
5. **Framework Independence**: Business logic is isolated from NestJS

## Usage Pattern

1. **Request** → Controller (Presentation)
2. **Controller** → Use Case (Application)
3. **Use Case** → Domain Service (Domain)
4. **Domain Service** → Repository Interface (Domain)
5. **Repository Implementation** → Database (Infrastructure)