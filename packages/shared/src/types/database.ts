// ================================================================
// Tipos generados automáticamente desde el esquema de Supabase.
// NO editar a mano. Regenerar con:
//   npx supabase gen types --linked > packages/shared/src/types/database.ts
// o vía MCP generate_typescript_types.
// Proyecto: pebdhasajkvsjttclbhf
// ================================================================

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: '14.18';
  };
  public: {
    Tables: {
      categories: {
        Row: {
          created_at: string;
          description: string | null;
          id: string;
          is_active: boolean;
          name: string;
          position: number;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          id?: string;
          is_active?: boolean;
          name: string;
          position?: number;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          id?: string;
          is_active?: boolean;
          name?: string;
          position?: number;
        };
        Relationships: [];
      };
      products: {
        Row: {
          base_price: number;
          category_id: string;
          created_at: string;
          description: string | null;
          id: string;
          is_available: boolean;
          name: string;
          position: number;
          source: string | null;
          source_id: string | null;
          source_url: string | null;
          updated_at: string;
        };
        Insert: {
          base_price: number;
          category_id: string;
          created_at?: string;
          description?: string | null;
          id?: string;
          is_available?: boolean;
          name: string;
          position?: number;
          source?: string | null;
          source_id?: string | null;
          source_url?: string | null;
          updated_at?: string;
        };
        Update: {
          base_price?: number;
          category_id?: string;
          created_at?: string;
          description?: string | null;
          id?: string;
          is_available?: boolean;
          name?: string;
          position?: number;
          source?: string | null;
          source_id?: string | null;
          source_url?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      product_variants: {
        Row: {
          id: string;
          is_active: boolean;
          name: string;
          price: number;
          product_id: string;
        };
        Insert: {
          id?: string;
          is_active?: boolean;
          name: string;
          price: number;
          product_id: string;
        };
        Update: {
          id?: string;
          is_active?: boolean;
          name?: string;
          price?: number;
          product_id?: string;
        };
        Relationships: [];
      };
      product_images: {
        Row: {
          created_at: string;
          id: string;
          position: number;
          product_id: string;
          storage_path: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          position?: number;
          product_id: string;
          storage_path: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          position?: number;
          product_id?: string;
          storage_path?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          birth_date: string | null;
          created_at: string;
          full_name: string;
          id: string;
          phone: string | null;
          updated_at: string;
        };
        Insert: {
          avatar_url?: string | null;
          birth_date?: string | null;
          created_at?: string;
          full_name?: string;
          id: string;
          phone?: string | null;
          updated_at?: string;
        };
        Update: {
          avatar_url?: string | null;
          birth_date?: string | null;
          created_at?: string;
          full_name?: string;
          id?: string;
          phone?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      roles: {
        Row: { id: number; name: string };
        Insert: { id?: never; name: string };
        Update: { id?: never; name?: string };
        Relationships: [];
      };
      staff_members: {
        Row: {
          created_at: string;
          employee_code: string | null;
          id: string;
          is_active: boolean;
          profile_id: string;
        };
        Insert: {
          created_at?: string;
          employee_code?: string | null;
          id?: string;
          is_active?: boolean;
          profile_id: string;
        };
        Update: {
          created_at?: string;
          employee_code?: string | null;
          id?: string;
          is_active?: boolean;
          profile_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'staff_members_profile_id_fkey';
            columns: ['profile_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      user_roles: {
        Row: {
          granted_at: string;
          granted_by: string | null;
          role_id: number;
          user_id: string;
        };
        Insert: {
          granted_at?: string;
          granted_by?: string | null;
          role_id: number;
          user_id: string;
        };
        Update: {
          granted_at?: string;
          granted_by?: string | null;
          role_id?: number;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'user_roles_role_id_fkey';
            columns: ['role_id'];
            isOneToOne: false;
            referencedRelation: 'roles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'user_roles_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
