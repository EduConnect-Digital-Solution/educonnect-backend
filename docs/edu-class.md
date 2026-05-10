# Classes API Specification

---

## 1. Get School Classes

**Endpoint:** `GET /api/admin/classes`

**Description:** Fetches the full list of school-wide classes.

### Request

No request body required.

### Response

```json
{
  "success": true,
  "data": {
    "classes": [
      {
        "id": "string",
        "name": "string",
        "baseLevel": "string",
        "arm": "string | null"
      }
    ]
  }
}
```

---

## 2. Bulk Create Classes

**Endpoint:** `POST /api/admin/classes/bulk`

**Description:** Saves an entire generated matrix configuration of base classes and arms in a single request.

### Request

```json
{
  "classes": [
    {
      "baseLevel": "SS 1",
      "arm": "Science",
      "name": "SS 1 Science"
    }
  ]
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `classes` | array | Yes | Array of class objects to create |
| `classes[].baseLevel` | string | Yes | The base level (e.g. `"SS 1"`, `"JSS 2"`) |
| `classes[].arm` | string | Yes | The class arm (e.g. `"Science"`, `"Arts"`) |
| `classes[].name` | string | Yes | Full display name, typically `"{baseLevel} {arm}"` |

### Response

```json
{
  "success": true,
  "data": {
    "classes": [
      {
        "id": "db_generated_string",
        "baseLevel": "SS 1",
        "arm": "Science",
        "name": "SS 1 Science"
      }
    ]
  }
}
```

The response mirrors the request payload with a DB-generated `id` added to each class object.

---

## 3. Delete Class

**Endpoint:** `DELETE /api/admin/classes/:id`

**Description:** Permanently removes a class by its ID.

### Request

No request body required. The class ID is passed as a URL path parameter.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `id` | string | Yes | The ID of the class to delete |

### Response

```json
{
  "success": true,
  "message": "1 class deleted successfully",
  "data": {
    "deleted": 1,
    "errors": []
  }
}
```
