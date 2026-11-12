# DESIGN-NNN — {Title}

> Technical design artifact. Reads PROPOSAL-NNN and SPEC-NNN. Defines HOW the system will implement the specification. Does not contain code — contains architecture, patterns, data flow, and module boundaries.

---

## Meta

- **ID:** DESIGN-NNN
- **Status:** {draft | reviewed | approved | superseded}
- **Origin proposal:** PROPOSAL-NNN
- **Origin spec:** SPEC-NNN
- **Related ADRs:** {ADR-NNN, ...}
- **Created:** {YYYY-MM-DD}

---

## 1. Problem recap

One sentence. What are we solving, referencing SPEC-NNN.

---

## 2. Approach

Two to three paragraphs. The overall technical strategy. Which pattern, which layer, which direction of change.

---

## 3. Architecture impact

### 3.1 Layer mapping

|Change|Domain|Data|Presentation|
|---|---|---|---|
|{change description}|{affected? how?}|{affected? how?}|{affected? how?}|

### 3.2 Module boundaries

Which modules/packages are affected and what changes in their public API (if any).

- **{module}** — {what changes, what stays stable}
- **{module}** — {what changes, what stays stable}

### 3.3 New files to create

|File path|Purpose|Estimated lines|
|---|---|---|---|
|{path/to/file.kt or .ts}|{one-line purpose}|{estimate, must be under 300}|

### 3.4 Existing files to modify

|File path|Nature of change|Risk|
|---|---|---|
|{path/to/file}|{add method / refactor / extend}|{low / medium / high}|

---

## 4. Data model changes

### 4.1 New entities or fields

|Entity/Table|Change|Notes|
|---|---|---|
|{entity_name}|{add field / new table / alter column}|{migration required? RLS impact?}|

### 4.2 Migration strategy

- **Migration file:** `[NNN]_{name}.sql`
- **Breaking?** {yes/no}
- **Data migration needed?** {yes/no, describe if yes}
- **RLS policies affected?** {yes/no, describe if yes}

---

## 5. API / Interface contracts

### 5.1 New API endpoints or RPC changes

|Endpoint/RPC|Method|Input|Output|Auth|
|---|---|---|---|---|
|{path or rpc name}|{GET/POST/rpc}|{params}|{response}|{required role}|

### 5.2 Repository interface changes

|Interface|New method|Return type|Notes|
|---|---|---|---|
|{RepositoryName}|{methodName}|{type}|{notes}|

---

## 6. Data flow

How data moves through the system for the main use case(s). Use a sequence or flow description.

```
User Action → Presentation → UseCase → Repository (interface) → Data Layer → Remote/Local
                                                        ↓
                                              Domain Entity returned
```

---

## 7. Error handling strategy

|Error type|Presentation behavior|Data layer behavior|
|---|---|---|
|{Network error}|{UI state}|{Retry / cache fallback}|
|{Validation error}|{Inline message}|{Reject early at Domain}|
|{Auth error}|{Redirect to login}|{Token refresh or fail}|

---

## 8. Testing strategy

|Layer|What to test|How|
|---|---|---|
|Domain|{UseCase logic, business rules}|Unit tests, mirror Domain first|
|Data|{Repository impl, mappers, DTOs}|Unit tests with fake data sources|
|Presentation|{ViewModel/Controller state transitions}|Integration tests where the project has them|

---

## 9. Risks and trade-offs

|Risk|Likelihood|Impact|Mitigation|
|---|---|---|---|
|{risk}|{low/medium/high}|{low/medium/high}|{how to handle}|

---

## 10. Alternatives considered

|Option|Why not|
|---|---|
|{alternative approach}|{reason it was rejected}|

---

**Template version:** v1.0