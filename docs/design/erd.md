# ERD (Entity Relationship Diagram)

Status: final for the MVP (P1-T08, reviewed 2026-11-24). The details of each entity are in `data-model.md`. Order and payment states are drawn in `order-state-machine.md` (P1-T09).

Tool: Mermaid (plain text in git, renders in VS Code and GitHub).

## Rules used to choose embed vs reference
Sources: MongoDB Manual (Embedded Data, Reference Data, Atomicity, Data Modeling Best Practices).

Ask these questions for every relationship:
1. Is the child always read together with the parent? Leans to **embed**.
2. Is the child count bounded and small? If it can grow without limit, **reference**.
3. Is the child queried on its own? **Reference**.
4. Does the child change often and must stay one single truth? **Reference**.
5. Must the child change atomically with the parent? **Embed**.
6. Is the child a snapshot of a moment in time (for example an order line)? **Embed**, as a frozen copy.

## Diagram
Legend: `PK` primary key, `UK` unique, `FK` reference to another collection. Embedded children are marked in the relationship label. Solid line = stored link (embedded or `ObjectId` reference). Dashed line = no stored foreign key (matched by value, or a polymorphic link).

```mermaid
erDiagram
    USER ||--o{ ADDRESS : "embeds (max 10)"
    USER ||--o{ AUDIT_LOG : "acts (ref actorId)"
    CATEGORY ||--o{ PRODUCT : "has (ref categoryId)"
    PRODUCT ||--o{ VARIANT : "has (ref productId)"
    USER ||--o| CART : "owns (unique userId)"
    CART ||--o{ CART_ITEM : "embeds (max lines)"
    CART_ITEM }o--|| VARIANT : "refs variantId"
    USER ||--o{ ORDER : "places (ref userId)"
    ORDER ||--|{ ORDER_ITEM : "embeds (snapshots)"
    ORDER_ITEM }o--|| VARIANT : "refs variantId (for restock)"
    ORDER }o--o| COUPON : "refs couponId + snapshot"
    ORDER ||--o{ RETURN_REQUEST : "has (ref orderId)"
    USER ||--o{ RETURN_REQUEST : "requests (ref userId)"
    USER |o--o{ ORDER : "staff refs (statusHistory.by, cancelledBy, paymentConfirmedBy)"
    SHIPPING_ZONE }o..o{ ADDRESS : "matches by governorate string (no FK)"
    AUDIT_LOG }o..o| VARIANT : "entityType + entityId (also Order, Coupon, User, ...)"

    USER {
        ObjectId _id PK
        string name
        string email UK
        string phone
        string passwordHash
        string role "admin | catalog_manager | order_operator | customer"
        boolean isActive
        date passwordChangedAt
        string passwordResetTokenHash
        date passwordResetExpires
        date createdAt
        date updatedAt
    }
    ADDRESS {
        ObjectId _id PK
        string label
        string recipientName
        string phone
        string governorate
        string city
        string street
        string details
        string notes
        boolean isDefault
    }
    AUDIT_LOG {
        ObjectId _id PK
        ObjectId actorId FK
        string actorRole
        string action
        string entityType
        ObjectId entityId
        mixed before
        mixed after
        string reason "required for stock: initial_stock | restock | damaged | lost | correction | order_placed | order_cancelled"
        string note
        mixed meta "for example change, orderId"
        date createdAt
    }
    CATEGORY {
        ObjectId _id PK
        string name UK "case-insensitive"
        string slug UK
        string description
        boolean isActive
        date createdAt
        date updatedAt
    }
    PRODUCT {
        ObjectId _id PK
        string title
        string slug UK
        string description
        ObjectId categoryId FK
        string[] images "URLs, max count"
        boolean isActive
        date createdAt
        date updatedAt
    }
    VARIANT {
        ObjectId _id PK
        ObjectId productId FK
        string sku UK
        string size
        string color
        int price "piasters, > 0"
        int stock "min 0, default 0"
        boolean initialStockSet
        boolean isActive
        date createdAt
        date updatedAt
    }
    CART {
        ObjectId _id PK
        ObjectId userId FK "unique"
        date createdAt
        date updatedAt
    }
    CART_ITEM {
        ObjectId variantId FK
        int quantity "no price stored"
    }
    COUPON {
        ObjectId _id PK
        string code UK "uppercase"
        string type "percent | fixed"
        int value
        int maxDiscount "percent only"
        int minSubtotal
        date startsAt
        date expiresAt
        int usageLimit "null = unlimited"
        int usedCount "server managed"
        boolean isActive
    }
    SHIPPING_ZONE {
        ObjectId _id PK
        string name UK
        string[] governorates "unique among active zones"
        int fee "piasters"
        boolean isActive
    }
    ORDER {
        ObjectId _id PK
        string orderNumber UK
        ObjectId userId FK
        object shippingAddress "embedded snapshot"
        int subtotal "snapshot"
        int discount "snapshot, <= subtotal"
        int shippingFee "snapshot"
        int total "snapshot"
        string currency "EGP"
        object coupon "couponId ref + code/type/value snapshot"
        string status "pending | accepted | packing | shipped | delivered | cancelled"
        string paymentMethod "cod"
        string paymentStatus "pending | paid | voided"
        date paidAt
        ObjectId paymentConfirmedBy FK
        array statusHistory "embedded: status, at, by, byRole, note"
        object shipment "carrier, trackingNote, shippedAt, deliveredAt"
        object cancellation "cancelledAt, cancelledBy, cancelledByRole, reason"
        date createdAt
        date updatedAt
    }
    ORDER_ITEM {
        ObjectId productId FK "trace only"
        ObjectId variantId FK "needed to restock"
        string sku "snapshot"
        string title "snapshot"
        string size "snapshot"
        string color "snapshot"
        int unitPrice "snapshot"
        int quantity
        int lineTotal "snapshot"
    }
    RETURN_REQUEST {
        ObjectId _id PK
        ObjectId orderId FK
        ObjectId userId FK
        array items "variantId, sku, title, quantity"
        string reason
        string status "requested | approved | rejected | received"
        string refundStatus "not_required | pending | refunded_manually"
        array statusHistory
        date createdAt
        date updatedAt
    }
```
