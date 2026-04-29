/**
 * database.types.ts
 * =================
 * Auto-derived TypeScript types from the CareSync Supabase schema.
 * Reflects the exact tables, enums, and relationships defined in supabase/schema.sql.
 *
 * Convention used throughout the app:
 *   - Database row types:  Tables<'table_name'>['Row']
 *   - Insert types:        Tables<'table_name'>['Insert']
 *   - Update types:        Tables<'table_name'>['Update']
 */

export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

// ---------------------------------------------------------------------------
// Enums — mirror the PostgreSQL CREATE TYPE definitions exactly
// ---------------------------------------------------------------------------
export type CareCircleRole   = "admin" | "collaborator" | "viewer";
export type TaskStatus       = "pending" | "in_progress" | "completed" | "cancelled";
export type TaskPriority     = "low" | "medium" | "high" | "critical";
export type BroadcastSeverity = "info" | "warning" | "critical";
export type AVSReviewStatus  = "pending_human_review" | "approved" | "rejected";

// ---------------------------------------------------------------------------
// Database shape — used by the Supabase client generic
// ---------------------------------------------------------------------------
export interface Database {
  public: {
    Tables: {

      // ── profiles ──────────────────────────────────────────────────────────
      profiles: {
        Row: {
          id:          string;          // uuid, references auth.users
          first_name:  string;
          last_name:   string;
          avatar_url:  string | null;
          created_at:  string;          // timestamptz as ISO string
          updated_at:  string;
        };
        Insert: {
          id:          string;
          first_name:  string;
          last_name:   string;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          first_name?: string;
          last_name?:  string;
          avatar_url?: string | null;
          updated_at?: string;
        };
      };

      // ── care_circles ─────────────────────────────────────────────────────
      care_circles: {
        Row: {
          id:          string;
          name:        string;
          created_by:  string;
          created_at:  string;
        };
        Insert: {
          id?:         string;
          name:        string;
          created_by:  string;
          created_at?: string;
        };
        Update: {
          name?:       string;
        };
      };

      // ── care_circle_members ───────────────────────────────────────────────
      care_circle_members: {
        Row: {
          id:              string;
          care_circle_id:  string;
          user_id:         string;
          role:            CareCircleRole;
          joined_at:       string;
        };
        Insert: {
          id?:             string;
          care_circle_id:  string;
          user_id:         string;
          role?:           CareCircleRole;
          joined_at?:      string;
        };
        Update: {
          role?:           CareCircleRole;
        };
      };

      // ── patients ──────────────────────────────────────────────────────────
      patients: {
        Row: {
          id:                string;
          care_circle_id:    string;
          linked_profile_id: string | null;
          first_name:        string;
          last_name:         string;
          date_of_birth:     string | null;   // date as ISO string
          created_at:        string;
        };
        Insert: {
          id?:               string;
          care_circle_id:    string;
          linked_profile_id?: string | null;
          first_name:        string;
          last_name:         string;
          date_of_birth?:    string | null;
          created_at?:       string;
        };
        Update: {
          linked_profile_id?: string | null;
          first_name?:        string;
          last_name?:         string;
          date_of_birth?:     string | null;
        };
      };

      // ── tasks ─────────────────────────────────────────────────────────────
      tasks: {
        Row: {
          id:              string;
          care_circle_id:  string;
          patient_id:      string | null;
          title:           string;
          notes:           string | null;
          status:          TaskStatus;
          priority:        TaskPriority;
          assigned_to:     string | null;
          due_date:        string | null;     // timestamptz as ISO string
          sort_order:      number | null;     // display order for timeless tasks
          completed_at:    string | null;
          completed_by:    string | null;     // profile UUID who marked it done
          created_by:      string;
          created_at:      string;
          updated_at:      string;
        };
        Insert: {
          id?:             string;
          care_circle_id:  string;
          patient_id?:     string | null;
          title:           string;
          notes?:          string | null;
          status?:         TaskStatus;
          priority?:       TaskPriority;
          assigned_to?:    string | null;
          due_date?:       string | null;
          sort_order?:     number | null;
          completed_at?:   string | null;
          completed_by?:   string | null;
          created_by:      string;
          created_at?:     string;
          updated_at?:     string;
        };
        Update: {
          title?:          string;
          notes?:          string | null;
          status?:         TaskStatus;
          priority?:       TaskPriority;
          assigned_to?:    string | null;
          due_date?:       string | null;
          sort_order?:     number | null;
          completed_at?:   string | null;
          completed_by?:   string | null;
          updated_at?:     string;
        };
      };

      // ── calendar_events ───────────────────────────────────────────────────
      calendar_events: {
        Row: {
          id:              string;
          care_circle_id:  string;
          patient_id:      string | null;
          title:           string;
          description:     string | null;
          location:        string | null;
          start_time:      string;            // timestamptz as ISO string
          end_time:        string;
          completed_by:    string | null;     // profile UUID who confirmed the event
          completed_at:    string | null;
          created_by:      string;
          created_at:      string;
        };
        Insert: {
          id?:             string;
          care_circle_id:  string;
          patient_id?:     string | null;
          title:           string;
          description?:    string | null;
          location?:       string | null;
          start_time:      string;
          end_time:        string;
          completed_by?:   string | null;
          completed_at?:   string | null;
          created_by:      string;
          created_at?:     string;
        };
        Update: {
          title?:          string;
          description?:    string | null;
          location?:       string | null;
          start_time?:     string;
          end_time?:       string;
          completed_by?:   string | null;
          completed_at?:   string | null;
        };
      };

      // ── broadcast_updates ─────────────────────────────────────────────────
      broadcast_updates: {
        Row: {
          id:              string;
          care_circle_id:  string;
          title:           string;
          content:         string;
          severity:        BroadcastSeverity;
          author_id:       string;
          created_at:      string;
        };
        Insert: {
          id?:             string;
          care_circle_id:  string;
          title:           string;
          content:         string;
          severity?:       BroadcastSeverity;
          author_id:       string;
          created_at?:     string;
        };
        Update: {
          title?:          string;
          content?:        string;
          severity?:       BroadcastSeverity;
        };
      };

      // ── avs_documents ─────────────────────────────────────────────────────
      avs_documents: {
        Row: {
          id:                string;
          care_circle_id:    string;
          patient_id:        string;
          document_label:    string;
          visit_date:        string | null;   // date as ISO string
          provider_name:     string | null;
          review_status:     AVSReviewStatus;
          reviewed_by:       string | null;
          reviewed_at:       string | null;
          local_storage_key: string | null;
          scanned_by:        string;
          scanned_at:        string;
        };
        Insert: {
          id?:               string;
          care_circle_id:    string;
          patient_id:        string;
          document_label?:   string;
          visit_date?:       string | null;
          provider_name?:    string | null;
          review_status?:    AVSReviewStatus;
          reviewed_by?:      string | null;
          reviewed_at?:      string | null;
          local_storage_key?: string | null;
          scanned_by:        string;
          scanned_at?:       string;
        };
        Update: {
          document_label?:   string;
          visit_date?:       string | null;
          provider_name?:    string | null;
          review_status?:    AVSReviewStatus;
          reviewed_by?:      string | null;
          reviewed_at?:      string | null;
          local_storage_key?: string | null;
        };
      };
    };

    Views:   Record<string, never>;
    Functions: {
      create_care_circle: {
        Args:    { circle_name: string };
        Returns: string;
      };
    };
    Enums: {
      care_circle_role:    CareCircleRole;
      task_status:         TaskStatus;
      task_priority:       TaskPriority;
      broadcast_severity:  BroadcastSeverity;
      avs_review_status:   AVSReviewStatus;
    };
  };
}

// ---------------------------------------------------------------------------
// Convenience re-exports — use these throughout the app instead of the
// verbose Tables<'x'>['Row'] syntax
// ---------------------------------------------------------------------------
export type Profile         = Database["public"]["Tables"]["profiles"]["Row"];
export type CareCircle      = Database["public"]["Tables"]["care_circles"]["Row"];
export type CareCircleMember = Database["public"]["Tables"]["care_circle_members"]["Row"];
export type Patient         = Database["public"]["Tables"]["patients"]["Row"];
export type Task            = Database["public"]["Tables"]["tasks"]["Row"];
export type TaskInsert      = Database["public"]["Tables"]["tasks"]["Insert"];
export type TaskUpdate      = Database["public"]["Tables"]["tasks"]["Update"];
export type CalendarEvent   = Database["public"]["Tables"]["calendar_events"]["Row"];
export type CalendarEventInsert = Database["public"]["Tables"]["calendar_events"]["Insert"];
export type BroadcastUpdate = Database["public"]["Tables"]["broadcast_updates"]["Row"];
export type BroadcastUpdateInsert = Database["public"]["Tables"]["broadcast_updates"]["Insert"];
export type AVSDocument     = Database["public"]["Tables"]["avs_documents"]["Row"];
export type AVSDocumentInsert = Database["public"]["Tables"]["avs_documents"]["Insert"];
