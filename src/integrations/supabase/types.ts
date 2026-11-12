export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      attendance: {
        Row: {
          clock_in: string
          clock_out: string | null
          created_at: string
          id: string
          in_accuracy: number | null
          in_ip: string | null
          in_lat: number | null
          in_lng: number | null
          in_location_name: string | null
          in_onsite: boolean | null
          out_accuracy: number | null
          out_ip: string | null
          last_seen_at: string | null
          auto_closed: boolean
          out_lat: number | null
          out_lng: number | null
          out_location_name: string | null
          out_onsite: boolean | null
          user_id: string
          work_date: string
        }
        Insert: {
          clock_in?: string
          clock_out?: string | null
          created_at?: string
          id?: string
          in_accuracy?: number | null
          in_ip?: string | null
          in_lat?: number | null
          in_lng?: number | null
          in_location_name?: string | null
          in_onsite?: boolean | null
          out_accuracy?: number | null
          out_ip?: string | null
          last_seen_at?: string | null
          auto_closed?: boolean
          out_lat?: number | null
          out_lng?: number | null
          out_location_name?: string | null
          out_onsite?: boolean | null
          user_id: string
          work_date?: string
        }
        Update: {
          clock_in?: string
          clock_out?: string | null
          created_at?: string
          id?: string
          in_accuracy?: number | null
          in_ip?: string | null
          in_lat?: number | null
          in_lng?: number | null
          in_location_name?: string | null
          in_onsite?: boolean | null
          out_accuracy?: number | null
          out_ip?: string | null
          last_seen_at?: string | null
          auto_closed?: boolean
          out_lat?: number | null
          out_lng?: number | null
          out_location_name?: string | null
          out_onsite?: boolean | null
          user_id?: string
          work_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      breaks: {
        Row: {
          attendance_id: string
          end_accuracy: number | null
          end_ip: string | null
          end_at: string | null
          end_lat: number | null
          end_lng: number | null
          id: string
          start_accuracy: number | null
          start_ip: string | null
          start_at: string
          start_lat: number | null
          start_lng: number | null
          user_id: string
        }
        Insert: {
          attendance_id: string
          end_accuracy?: number | null
          end_ip?: string | null
          end_at?: string | null
          end_lat?: number | null
          end_lng?: number | null
          id?: string
          start_accuracy?: number | null
          start_ip?: string | null
          start_at?: string
          start_lat?: number | null
          start_lng?: number | null
          user_id: string
        }
        Update: {
          attendance_id?: string
          end_accuracy?: number | null
          end_ip?: string | null
          end_at?: string | null
          end_lat?: number | null
          end_lng?: number | null
          id?: string
          start_accuracy?: number | null
          start_ip?: string | null
          start_at?: string
          start_lat?: number | null
          start_lng?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "breaks_attendance_id_fkey"
            columns: ["attendance_id"]
            isOneToOne: false
            referencedRelation: "attendance"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "breaks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      location_events: {
        Row: {
          accuracy: number | null
          ip: string | null
          action: string
          attendance_id: string
          break_id: string | null
          captured_at: string
          distance_m: number | null
          expected_lat: number | null
          expected_lng: number | null
          expected_name: string | null
          id: string
          lat: number | null
          lng: number | null
          radius_m: number | null
          review_status: string
          user_id: string
          work_date: string
        }
        Insert: {
          accuracy?: number | null
          ip?: string | null
          action: string
          attendance_id: string
          break_id?: string | null
          captured_at?: string
          distance_m?: number | null
          expected_lat?: number | null
          expected_lng?: number | null
          expected_name?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          radius_m?: number | null
          review_status: string
          user_id: string
          work_date: string
        }
        Update: {
          accuracy?: number | null
          ip?: string | null
          action?: string
          attendance_id?: string
          break_id?: string | null
          captured_at?: string
          distance_m?: number | null
          expected_lat?: number | null
          expected_lng?: number | null
          expected_name?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          radius_m?: number | null
          review_status?: string
          user_id?: string
          work_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "location_events_attendance_id_fkey"
            columns: ["attendance_id"]
            isOneToOne: false
            referencedRelation: "attendance"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "location_events_break_id_fkey"
            columns: ["break_id"]
            isOneToOne: false
            referencedRelation: "breaks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "location_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          deleted_at: string | null
          email: string
          full_name: string
          id: string
          shift_end: string | null
          shift_start: string | null
          suspended_at: string | null
          team_id: string | null
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          email: string
          full_name?: string
          id: string
          shift_end?: string | null
          shift_start?: string | null
          suspended_at?: string | null
          team_id?: string | null
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          email?: string
          full_name?: string
          id?: string
          shift_end?: string | null
          shift_start?: string | null
          suspended_at?: string | null
          team_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          attachment_name: string | null
          attachment_path: string | null
          created_at: string
          description: string | null
          hours: number
          id: string
          status: Database["public"]["Enums"]["task_status"]
          title: string
          user_id: string
          work_date: string
        }
        Insert: {
          attachment_name?: string | null
          attachment_path?: string | null
          created_at?: string
          description?: string | null
          hours?: number
          id?: string
          status?: Database["public"]["Enums"]["task_status"]
          title: string
          user_id: string
          work_date?: string
        }
        Update: {
          attachment_name?: string | null
          attachment_path?: string | null
          created_at?: string
          description?: string | null
          hours?: number
          id?: string
          status?: Database["public"]["Enums"]["task_status"]
          title?: string
          user_id?: string
          work_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          created_at: string
          id: string
          manager_id: string | null
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          manager_id?: string | null
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          manager_id?: string | null
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "teams_manager_fk"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_locations: {
        Row: {
          location_id: string
          user_id: string
        }
        Insert: {
          location_id: string
          user_id: string
        }
        Update: {
          location_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_locations_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "work_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_locations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      work_locations: {
        Row: {
          created_at: string
          id: string
          lat: number
          lng: number
          name: string
          radius_m: number
        }
        Insert: {
          created_at?: string
          id?: string
          lat: number
          lng: number
          name: string
          radius_m?: number
        }
        Update: {
          created_at?: string
          id?: string
          lat?: number
          lng?: number
          name?: string
          radius_m?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_active_user: { Args: { _user_id: string }; Returns: boolean }
      my_account_status: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      manages_user: {
        Args: { _manager: string; _user: string }
        Returns: boolean
      }
      nearest_work_location: {
        Args: { _lat: number; _lng: number; _user: string }
        Returns: Record<string, unknown>
      }
    }
    Enums: {
      app_role: "admin" | "manager" | "employee"
      task_status: "done" | "in_progress" | "blocked"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "manager", "employee"],
      task_status: ["done", "in_progress", "blocked"],
    },
  },
} as const
