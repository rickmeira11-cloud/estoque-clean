export type UserRole = 'super_admin' | 'admin' | 'operator' | 'viewer'
export type Church = { id: string; name: string; slug: string; city: string | null; state: string | null; is_active: boolean; created_at: string; updated_at: string }
export type Profile = { id: string; church_id: string; name: string | null; email: string | null; role: UserRole; is_active: boolean; created_at: string; updated_at: string | null; church?: Church | null }
export type Product = { id: string; church_id: string; name: string; quantity: number; min_stock: number; category: string | null; type: 'perishable' | 'non_perishable'; container: string | null; unit: string; last_purchase_value: number | null; expiration_date: string | null; notes: string | null; is_active: boolean; created_at: string; updated_at: string }
export type MovementType = 'in' | 'out' | 'adjustment'
export type StockMovement = { id: string; church_id: string; product_id: string; user_id: string | null; type: MovementType; quantity: number; note: string | null; created_at: string; product?: { id: string; name: string; category: string | null } | null; profile?: { id: string; name: string | null; email: string | null } | null }
