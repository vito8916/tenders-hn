export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      ai_credit_ledger: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          cycle_start: string
          description: string | null
          id: number
          idempotency_key: string
          kind: string
          org_id: string
          reservation_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          cycle_start: string
          description?: string | null
          id?: never
          idempotency_key: string
          kind: string
          org_id: string
          reservation_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          cycle_start?: string
          description?: string | null
          id?: never
          idempotency_key?: string
          kind?: string
          org_id?: string
          reservation_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_credit_ledger_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_credit_ledger_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "ai_credit_reservations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_credit_reservations: {
        Row: {
          amount: number
          created_at: string
          cycle_start: string
          expires_at: string
          id: string
          idempotency_key: string
          metadata: Json
          org_id: string
          purpose: string
          settled_at: string | null
          status: string
          user_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          cycle_start: string
          expires_at: string
          id?: string
          idempotency_key: string
          metadata?: Json
          org_id: string
          purpose: string
          settled_at?: string | null
          status?: string
          user_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          cycle_start?: string
          expires_at?: string
          id?: string
          idempotency_key?: string
          metadata?: Json
          org_id?: string
          purpose?: string
          settled_at?: string | null
          status?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_credit_reservations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_model_rates: {
        Row: {
          credits_per_1k_input: number
          credits_per_1k_output: number
          is_enabled: boolean
          model: string
          updated_at: string
        }
        Insert: {
          credits_per_1k_input: number
          credits_per_1k_output: number
          is_enabled?: boolean
          model: string
          updated_at?: string
        }
        Update: {
          credits_per_1k_input?: number
          credits_per_1k_output?: number
          is_enabled?: boolean
          model?: string
          updated_at?: string
        }
        Relationships: []
      }
      ai_usage_events: {
        Row: {
          created_at: string
          error: string | null
          id: number
          input_tokens: number | null
          latency_ms: number | null
          model: string
          org_id: string | null
          output_tokens: number | null
          reference: Json | null
          role: string
          status: string
        }
        Insert: {
          created_at?: string
          error?: string | null
          id?: never
          input_tokens?: number | null
          latency_ms?: number | null
          model: string
          org_id?: string | null
          output_tokens?: number | null
          reference?: Json | null
          role: string
          status: string
        }
        Update: {
          created_at?: string
          error?: string | null
          id?: never
          input_tokens?: number | null
          latency_ms?: number | null
          model?: string
          org_id?: string | null
          output_tokens?: number | null
          reference?: Json | null
          role?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_usage_events_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      app_events: {
        Row: {
          created_at: string
          event_name: string
          id: number
          metadata: Json | null
          org_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          event_name: string
          id?: never
          metadata?: Json | null
          org_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          event_name?: string
          id?: never
          metadata?: Json | null
          org_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "app_events_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_deliveries: {
        Row: {
          action_url: string | null
          attempts: number
          body: string | null
          channel: string
          created_at: string
          id: string
          idempotency_key: string
          last_error: string | null
          locked_at: string | null
          next_attempt_at: string
          notification_id: string | null
          org_id: string | null
          provider_message_id: string | null
          recipient: string
          sent_at: string | null
          status: string
          subject: string
          title: string
          type_id: string
          user_id: string
        }
        Insert: {
          action_url?: string | null
          attempts?: number
          body?: string | null
          channel?: string
          created_at?: string
          id?: string
          idempotency_key: string
          last_error?: string | null
          locked_at?: string | null
          next_attempt_at?: string
          notification_id?: string | null
          org_id?: string | null
          provider_message_id?: string | null
          recipient: string
          sent_at?: string | null
          status?: string
          subject: string
          title: string
          type_id: string
          user_id: string
        }
        Update: {
          action_url?: string | null
          attempts?: number
          body?: string | null
          channel?: string
          created_at?: string
          id?: string
          idempotency_key?: string
          last_error?: string | null
          locked_at?: string | null
          next_attempt_at?: string
          notification_id?: string | null
          org_id?: string | null
          provider_message_id?: string | null
          recipient?: string
          sent_at?: string | null
          status?: string
          subject?: string
          title?: string
          type_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_deliveries_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "notifications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_deliveries_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_deliveries_type_id_fkey"
            columns: ["type_id"]
            isOneToOne: false
            referencedRelation: "notification_types"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          email: boolean
          in_app: boolean
          type_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          email: boolean
          in_app: boolean
          type_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          email?: boolean
          in_app?: boolean
          type_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_preferences_type_id_fkey"
            columns: ["type_id"]
            isOneToOne: false
            referencedRelation: "notification_types"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_types: {
        Row: {
          category: string
          default_email: boolean
          default_in_app: boolean
          description: string
          id: string
          label: string
        }
        Insert: {
          category: string
          default_email?: boolean
          default_in_app?: boolean
          description: string
          id: string
          label: string
        }
        Update: {
          category?: string
          default_email?: boolean
          default_in_app?: boolean
          description?: string
          id?: string
          label?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          action_url: string | null
          body: string | null
          created_at: string
          data: Json
          dedupe_key: string | null
          id: string
          org_id: string | null
          read_at: string | null
          title: string
          type_id: string
          user_id: string
        }
        Insert: {
          action_url?: string | null
          body?: string | null
          created_at?: string
          data?: Json
          dedupe_key?: string | null
          id?: string
          org_id?: string | null
          read_at?: string | null
          title: string
          type_id: string
          user_id: string
        }
        Update: {
          action_url?: string | null
          body?: string | null
          created_at?: string
          data?: Json
          dedupe_key?: string | null
          id?: string
          org_id?: string | null
          read_at?: string | null
          title?: string
          type_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_type_id_fkey"
            columns: ["type_id"]
            isOneToOne: false
            referencedRelation: "notification_types"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_invitations: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          org_id: string
          role: string
          token: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          expires_at: string
          id?: string
          org_id: string
          role: string
          token: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          org_id?: string
          role?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_invitations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_members: {
        Row: {
          created_at: string
          id: string
          org_id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          org_id: string
          role: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          org_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_subscriptions: {
        Row: {
          canceled_at: string | null
          created_at: string
          current_period_end: string | null
          current_period_start: string
          org_id: string
          plan_id: string
          source: string
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          updated_at: string
        }
        Insert: {
          canceled_at?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string
          org_id: string
          plan_id: string
          source?: string
          status: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
        }
        Update: {
          canceled_at?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string
          org_id?: string
          plan_id?: string
          source?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_subscriptions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          id: string
          name: string
          org_logo_url: string | null
          owner_id: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          org_logo_url?: string | null
          owner_id: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          org_logo_url?: string | null
          owner_id?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      plans: {
        Row: {
          created_at: string
          description: string | null
          history_months: number | null
          id: string
          is_archived: boolean
          max_active_searches: number | null
          max_members: number | null
          min_schedule_interval: string | null
          monthly_ai_credits: number
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          history_months?: number | null
          id: string
          is_archived?: boolean
          max_active_searches?: number | null
          max_members?: number | null
          min_schedule_interval?: string | null
          monthly_ai_credits?: number
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          history_months?: number | null
          id?: string
          is_archived?: boolean
          max_active_searches?: number | null
          max_members?: number | null
          min_schedule_interval?: string | null
          monthly_ai_credits?: number
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      process_events: {
        Row: {
          after: Json | null
          before: Json | null
          id: number
          kind: string
          observed_at: string
          process_id: string
          version_id: string | null
        }
        Insert: {
          after?: Json | null
          before?: Json | null
          id?: never
          kind: string
          observed_at?: string
          process_id: string
          version_id?: string | null
        }
        Update: {
          after?: Json | null
          before?: Json | null
          id?: never
          kind?: string
          observed_at?: string
          process_id?: string
          version_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "process_events_process_id_fkey"
            columns: ["process_id"]
            isOneToOne: false
            referencedRelation: "procurement_processes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "process_events_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "process_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      process_versions: {
        Row: {
          content_sha256: string
          detail: Json
          id: string
          observed_at: string
          process_id: string
        }
        Insert: {
          content_sha256: string
          detail: Json
          id?: string
          observed_at?: string
          process_id: string
        }
        Update: {
          content_sha256?: string
          detail?: Json
          id?: string
          observed_at?: string
          process_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "process_versions_process_id_fkey"
            columns: ["process_id"]
            isOneToOne: false
            referencedRelation: "procurement_processes"
            referencedColumns: ["id"]
          },
        ]
      }
      procurement_processes: {
        Row: {
          acquisition_type: string | null
          buyer_entity: string
          closes_at: string | null
          current_version_id: string | null
          detail_url: string
          expediente: string
          first_seen_at: string
          id: string
          last_checked_at: string | null
          last_seen_at: string
          modality: string | null
          ocid: string | null
          purchase_unit: string | null
          search_tsv: unknown
          source: string
          source_process_key: string
          source_start_at: string | null
          stage: string | null
          title: string
        }
        Insert: {
          acquisition_type?: string | null
          buyer_entity: string
          closes_at?: string | null
          current_version_id?: string | null
          detail_url: string
          expediente: string
          first_seen_at?: string
          id?: string
          last_checked_at?: string | null
          last_seen_at?: string
          modality?: string | null
          ocid?: string | null
          purchase_unit?: string | null
          search_tsv?: unknown
          source: string
          source_process_key: string
          source_start_at?: string | null
          stage?: string | null
          title: string
        }
        Update: {
          acquisition_type?: string | null
          buyer_entity?: string
          closes_at?: string | null
          current_version_id?: string | null
          detail_url?: string
          expediente?: string
          first_seen_at?: string
          id?: string
          last_checked_at?: string | null
          last_seen_at?: string
          modality?: string | null
          ocid?: string | null
          purchase_unit?: string | null
          search_tsv?: unknown
          source?: string
          source_process_key?: string
          source_start_at?: string | null
          stage?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "procurement_processes_current_version_fkey"
            columns: ["current_version_id"]
            isOneToOne: false
            referencedRelation: "process_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          onboarding_completed_at: string | null
          phone: string | null
          status: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          onboarding_completed_at?: string | null
          phone?: string | null
          status?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          onboarding_completed_at?: string | null
          phone?: string | null
          status?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      source_documents: {
        Row: {
          first_seen_at: string
          id: string
          kind: string
          last_seen_at: string
          process_id: string
          removed_at: string | null
          source_url: string
          title: string
        }
        Insert: {
          first_seen_at?: string
          id?: string
          kind: string
          last_seen_at?: string
          process_id: string
          removed_at?: string | null
          source_url: string
          title: string
        }
        Update: {
          first_seen_at?: string
          id?: string
          kind?: string
          last_seen_at?: string
          process_id?: string
          removed_at?: string | null
          source_url?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "source_documents_process_id_fkey"
            columns: ["process_id"]
            isOneToOne: false
            referencedRelation: "procurement_processes"
            referencedColumns: ["id"]
          },
        ]
      }
      source_pages: {
        Row: {
          fetched_at: string
          html_sha256: string
          id: number
          page_number: number
          row_count: number | null
          status: string
          storage_path: string | null
          sync_run_id: number
        }
        Insert: {
          fetched_at?: string
          html_sha256: string
          id?: never
          page_number: number
          row_count?: number | null
          status: string
          storage_path?: string | null
          sync_run_id: number
        }
        Update: {
          fetched_at?: string
          html_sha256?: string
          id?: never
          page_number?: number
          row_count?: number | null
          status?: string
          storage_path?: string | null
          sync_run_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "source_pages_sync_run_id_fkey"
            columns: ["sync_run_id"]
            isOneToOne: false
            referencedRelation: "source_sync_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      source_sync_runs: {
        Row: {
          error: string | null
          finished_at: string | null
          id: number
          pages_expected: number | null
          pages_fetched: number
          processes_changed: number
          processes_new: number
          processes_seen: number
          source: string
          started_at: string
          status: string
          window_end: string
          window_start: string
        }
        Insert: {
          error?: string | null
          finished_at?: string | null
          id?: never
          pages_expected?: number | null
          pages_fetched?: number
          processes_changed?: number
          processes_new?: number
          processes_seen?: number
          source: string
          started_at?: string
          status?: string
          window_end: string
          window_start: string
        }
        Update: {
          error?: string | null
          finished_at?: string | null
          id?: never
          pages_expected?: number | null
          pages_fetched?: number
          processes_changed?: number
          processes_new?: number
          processes_seen?: number
          source?: string
          started_at?: string
          status?: string
          window_end?: string
          window_start?: string
        }
        Relationships: []
      }
      worker_heartbeats: {
        Row: {
          last_heartbeat_at: string
          started_at: string
          version: string | null
          worker_id: string
        }
        Insert: {
          last_heartbeat_at?: string
          started_at: string
          version?: string | null
          worker_id: string
        }
        Update: {
          last_heartbeat_at?: string
          started_at?: string
          version?: string | null
          worker_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_invitation: {
        Args: { invite_token: string }
        Returns: {
          org_id: string
          org_name: string
          org_slug: string
        }[]
      }
      claim_notification_deliveries: {
        Args: { batch_size?: number }
        Returns: {
          action_url: string | null
          attempts: number
          body: string | null
          channel: string
          created_at: string
          id: string
          idempotency_key: string
          last_error: string | null
          locked_at: string | null
          next_attempt_at: string
          notification_id: string | null
          org_id: string | null
          provider_message_id: string | null
          recipient: string
          sent_at: string | null
          status: string
          subject: string
          title: string
          type_id: string
          user_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "notification_deliveries"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      commit_ai_credits: {
        Args: { p_amount?: number; p_reservation_id: string }
        Returns: {
          amount: number
          created_at: string
          cycle_start: string
          expires_at: string
          id: string
          idempotency_key: string
          metadata: Json
          org_id: string
          purpose: string
          settled_at: string | null
          status: string
          user_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "ai_credit_reservations"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_ai_credit_balance: {
        Args: { target_org: string }
        Returns: {
          available: number
          cycle_end: string
          cycle_start: string
          granted: number
          reserved: number
          used: number
        }[]
      }
      get_invitation_by_token: {
        Args: { invite_token: string }
        Returns: {
          accepted_at: string
          created_at: string
          email: string
          expires_at: string
          id: string
          org_id: string
          org_name: string
          org_slug: string
          role: string
        }[]
      }
      get_organization_entitlements: {
        Args: { target_org: string }
        Returns: {
          current_period_end: string
          current_period_start: string
          history_months: number
          is_active: boolean
          max_active_searches: number
          max_members: number
          min_schedule_interval: string
          monthly_ai_credits: number
          org_id: string
          plan_id: string
          plan_name: string
          seats_used: number
          subscription_status: string
        }[]
      }
      list_my_pending_invitations: {
        Args: never
        Returns: {
          created_at: string
          email: string
          expires_at: string
          id: string
          org_id: string
          org_name: string
          org_slug: string
          role: string
          token: string
        }[]
      }
      log_app_event: {
        Args: { p_event_name: string; p_metadata?: Json; p_org_id?: string }
        Returns: undefined
      }
      release_ai_credits: {
        Args: { p_reservation_id: string }
        Returns: {
          amount: number
          created_at: string
          cycle_start: string
          expires_at: string
          id: string
          idempotency_key: string
          metadata: Json
          org_id: string
          purpose: string
          settled_at: string | null
          status: string
          user_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "ai_credit_reservations"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      reserve_ai_credits: {
        Args: {
          p_amount: number
          p_idempotency_key: string
          p_metadata?: Json
          p_org_id: string
          p_purpose: string
          p_ttl?: string
          p_user_id: string
        }
        Returns: {
          amount: number
          created_at: string
          cycle_start: string
          expires_at: string
          id: string
          idempotency_key: string
          metadata: Json
          org_id: string
          purpose: string
          settled_at: string | null
          status: string
          user_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "ai_credit_reservations"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      transfer_organization_ownership: {
        Args: { new_owner_user_id: string; target_org: string }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const

