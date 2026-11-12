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
    PostgrestVersion: "12.2.3 (519615d)"
  }
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
      activities: {
        Row: {
          activity_type: string
          actor_id: string
          created_at: string | null
          id: string
          metadata: Json | null
          target_id: string | null
          target_type: string | null
          user_id: string
        }
        Insert: {
          activity_type: string
          actor_id: string
          created_at?: string | null
          id?: string
          metadata?: Json | null
          target_id?: string | null
          target_type?: string | null
          user_id: string
        }
        Update: {
          activity_type?: string
          actor_id?: string
          created_at?: string | null
          id?: string
          metadata?: Json | null
          target_id?: string | null
          target_type?: string | null
          user_id?: string
        }
        Relationships: []
      }
      addresses: {
        Row: {
          address_label: string | null
          address_line_1: string
          address_line_2: string | null
          address_metadata: Json | null
          address_type: string
          city: string
          country: string
          created_at: string
          id: string
          is_default: boolean
          latitude: number | null
          longitude: number | null
          place_id: string | null
          postal_code: string
          source: string | null
          state: string
          updated_at: string
          user_id: string
        }
        Insert: {
          address_label?: string | null
          address_line_1: string
          address_line_2?: string | null
          address_metadata?: Json | null
          address_type?: string
          city: string
          country?: string
          created_at?: string
          id?: string
          is_default?: boolean
          latitude?: number | null
          longitude?: number | null
          place_id?: string | null
          postal_code: string
          source?: string | null
          state: string
          updated_at?: string
          user_id: string
        }
        Update: {
          address_label?: string | null
          address_line_1?: string
          address_line_2?: string | null
          address_metadata?: Json | null
          address_type?: string
          city?: string
          country?: string
          created_at?: string
          id?: string
          is_default?: boolean
          latitude?: number | null
          longitude?: number | null
          place_id?: string | null
          postal_code?: string
          source?: string | null
          state?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      admin_audit_logs: {
        Row: {
          action: string
          admin_id: string
          created_at: string | null
          details: Json | null
          id: string
          ip_address: string | null
          target_user_id: string | null
          user_agent: string | null
        }
        Insert: {
          action: string
          admin_id: string
          created_at?: string | null
          details?: Json | null
          id?: string
          ip_address?: string | null
          target_user_id?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          admin_id?: string
          created_at?: string | null
          details?: Json | null
          id?: string
          ip_address?: string | null
          target_user_id?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_audit_logs_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_audit_logs_target_user_id_fkey"
            columns: ["target_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_analytics: {
        Row: {
          average_response_time: number | null
          created_at: string | null
          date: string
          escalated_to_human: number | null
          id: string
          performance_metrics: Json | null
          successful_resolutions: number | null
          top_queries: Json | null
          total_interactions: number | null
          user_satisfaction_score: number | null
          user_type: string
        }
        Insert: {
          average_response_time?: number | null
          created_at?: string | null
          date: string
          escalated_to_human?: number | null
          id?: string
          performance_metrics?: Json | null
          successful_resolutions?: number | null
          top_queries?: Json | null
          total_interactions?: number | null
          user_satisfaction_score?: number | null
          user_type: string
        }
        Update: {
          average_response_time?: number | null
          created_at?: string | null
          date?: string
          escalated_to_human?: number | null
          id?: string
          performance_metrics?: Json | null
          successful_resolutions?: number | null
          top_queries?: Json | null
          total_interactions?: number | null
          user_satisfaction_score?: number | null
          user_type?: string
        }
        Relationships: []
      }
      ai_learning_data: {
        Row: {
          created_at: string | null
          feedback_details: string | null
          id: string
          interaction_id: string | null
          response_accuracy_score: number | null
          suggested_improvement: string | null
          user_feedback: string | null
        }
        Insert: {
          created_at?: string | null
          feedback_details?: string | null
          id?: string
          interaction_id?: string | null
          response_accuracy_score?: number | null
          suggested_improvement?: string | null
          user_feedback?: string | null
        }
        Update: {
          created_at?: string | null
          feedback_details?: string | null
          id?: string
          interaction_id?: string | null
          response_accuracy_score?: number | null
          suggested_improvement?: string | null
          user_feedback?: string | null
        }
        Relationships: []
      }
      ai_messages: {
        Row: {
          content: string
          cost: number | null
          created_at: string | null
          id: string
          metadata: Json | null
          role: string
          session_id: string | null
          tokens: number | null
        }
        Insert: {
          content: string
          cost?: number | null
          created_at?: string | null
          id?: string
          metadata?: Json | null
          role: string
          session_id?: string | null
          tokens?: number | null
        }
        Update: {
          content?: string
          cost?: number | null
          created_at?: string | null
          id?: string
          metadata?: Json | null
          role?: string
          session_id?: string | null
          tokens?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "ai_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_sessions: {
        Row: {
          context: Json
          created_at: string | null
          id: string
          is_active: boolean | null
          model: string | null
          product: string | null
          system_prompt: string | null
          title: string | null
          total_cost: number | null
          total_tokens: number | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          context?: Json
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          model?: string | null
          product?: string | null
          system_prompt?: string | null
          title?: string | null
          total_cost?: number | null
          total_tokens?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          context?: Json
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          model?: string | null
          product?: string | null
          system_prompt?: string | null
          title?: string | null
          total_cost?: number | null
          total_tokens?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      app_versions: {
        Row: {
          created_at: string | null
          download_url: string | null
          force_update: boolean | null
          id: number
          platform: string
          requires_store_update: boolean | null
          update_message: string | null
          version: string
        }
        Insert: {
          created_at?: string | null
          download_url?: string | null
          force_update?: boolean | null
          id?: number
          platform: string
          requires_store_update?: boolean | null
          update_message?: string | null
          version: string
        }
        Update: {
          created_at?: string | null
          download_url?: string | null
          force_update?: boolean | null
          id?: number
          platform?: string
          requires_store_update?: boolean | null
          update_message?: string | null
          version?: string
        }
        Relationships: []
      }
      auth_audit_logs: {
        Row: {
          action: string
          created_at: string
          id: number
          identifier: string | null
          ip: string | null
          meta: Json
          provider: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          id?: number
          identifier?: string | null
          ip?: string | null
          meta?: Json
          provider?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          id?: number
          identifier?: string | null
          ip?: string | null
          meta?: Json
          provider?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      auth_login_sessions: {
        Row: {
          auth_session_id: string | null
          created_at: string
          device_id: string
          device_label: string | null
          geo: Json | null
          id: string
          ip: string | null
          is_suspicious: boolean
          last_seen_at: string
          platform: string
          revoked_at: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth_session_id?: string | null
          created_at?: string
          device_id: string
          device_label?: string | null
          geo?: Json | null
          id?: string
          ip?: string | null
          is_suspicious?: boolean
          last_seen_at?: string
          platform?: string
          revoked_at?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth_session_id?: string | null
          created_at?: string
          device_id?: string
          device_label?: string | null
          geo?: Json | null
          id?: string
          ip?: string | null
          is_suspicious?: boolean
          last_seen_at?: string
          platform?: string
          revoked_at?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      auth_qr_login_challenges: {
        Row: {
          approved_at: string | null
          consumed_at: string | null
          created_at: string
          device_code: string
          expires_at: string
          id: string
          redeem_token_hash: string | null
          status: string
          user_id: string | null
        }
        Insert: {
          approved_at?: string | null
          consumed_at?: string | null
          created_at?: string
          device_code: string
          expires_at?: string
          id?: string
          redeem_token_hash?: string | null
          status?: string
          user_id?: string | null
        }
        Update: {
          approved_at?: string | null
          consumed_at?: string | null
          created_at?: string
          device_code?: string
          expires_at?: string
          id?: string
          redeem_token_hash?: string | null
          status?: string
          user_id?: string | null
        }
        Relationships: []
      }
      auth_rate_limits: {
        Row: {
          action: string
          created_at: string
          hits: number
          id: number
          identifier: string
          ip: string | null
          window_start: string
        }
        Insert: {
          action: string
          created_at?: string
          hits?: number
          id?: number
          identifier: string
          ip?: string | null
          window_start: string
        }
        Update: {
          action?: string
          created_at?: string
          hits?: number
          id?: number
          identifier?: string
          ip?: string | null
          window_start?: string
        }
        Relationships: []
      }
      blocked_users: {
        Row: {
          blocked_id: string
          blocker_id: string
          created_at: string | null
          id: string
        }
        Insert: {
          blocked_id: string
          blocker_id: string
          created_at?: string | null
          id?: string
        }
        Update: {
          blocked_id?: string
          blocker_id?: string
          created_at?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "blocked_users_blocked_id_fkey"
            columns: ["blocked_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blocked_users_blocker_id_fkey"
            columns: ["blocker_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      bogo_rules: {
        Row: {
          buy_categories: string[]
          buy_listing_ids: string[]
          buy_quantity: number
          created_at: string
          discount_profile_id: string
          get_categories: string[]
          get_discount_type: string
          get_discount_value: number
          get_listing_ids: string[]
          get_quantity: number
          id: string
          updated_at: string
        }
        Insert: {
          buy_categories?: string[]
          buy_listing_ids?: string[]
          buy_quantity?: number
          created_at?: string
          discount_profile_id: string
          get_categories?: string[]
          get_discount_type?: string
          get_discount_value?: number
          get_listing_ids?: string[]
          get_quantity?: number
          id?: string
          updated_at?: string
        }
        Update: {
          buy_categories?: string[]
          buy_listing_ids?: string[]
          buy_quantity?: number
          created_at?: string
          discount_profile_id?: string
          get_categories?: string[]
          get_discount_type?: string
          get_discount_value?: number
          get_listing_ids?: string[]
          get_quantity?: number
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bogo_rules_discount_profile_id_fkey"
            columns: ["discount_profile_id"]
            isOneToOne: true
            referencedRelation: "discount_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      breakout_rooms: {
        Row: {
          created_at: string | null
          created_by: string
          description: string | null
          id: string
          meeting_id: string
          room_name: string
          room_number: number
          status: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by: string
          description?: string | null
          id?: string
          meeting_id: string
          room_name: string
          room_number: number
          status?: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string
          description?: string | null
          id?: string
          meeting_id?: string
          room_name?: string
          room_number?: number
          status?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      breeze_webhook_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          order_id: string | null
          payload: Json
          processed: boolean
          shop_id: string | null
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          order_id?: string | null
          payload?: Json
          processed?: boolean
          shop_id?: string | null
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          order_id?: string | null
          payload?: Json
          processed?: boolean
          shop_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "breeze_webhook_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "customer_order_history_view"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "breeze_webhook_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "customer_orders_view"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "breeze_webhook_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "breeze_webhook_events_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "active_listings_view"
            referencedColumns: ["shop_id"]
          },
          {
            foreignKeyName: "breeze_webhook_events_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "payment_analytics"
            referencedColumns: ["shop_id"]
          },
          {
            foreignKeyName: "breeze_webhook_events_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shop_listings_summary"
            referencedColumns: ["shop_id"]
          },
          {
            foreignKeyName: "breeze_webhook_events_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      buyer_payment_methods: {
        Row: {
          card_brand: string | null
          created_at: string
          exp_month: number | null
          exp_year: number | null
          id: string
          is_default: boolean
          label: string | null
          last_four: string | null
          metadata: Json
          provider: string
          provider_token: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          card_brand?: string | null
          created_at?: string
          exp_month?: number | null
          exp_year?: number | null
          id?: string
          is_default?: boolean
          label?: string | null
          last_four?: string | null
          metadata?: Json
          provider?: string
          provider_token?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          card_brand?: string | null
          created_at?: string
          exp_month?: number | null
          exp_year?: number | null
          id?: string
          is_default?: boolean
          label?: string | null
          last_four?: string | null
          metadata?: Json
          provider?: string
          provider_token?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "buyer_payment_methods_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      call_session_participants: {
        Row: {
          call_session_id: string
          created_at: string
          id: string
          invite_status: Database["public"]["Enums"]["call_invite_status"]
          joined_at: string | null
          user_id: string
        }
        Insert: {
          call_session_id: string
          created_at?: string
          id?: string
          invite_status?: Database["public"]["Enums"]["call_invite_status"]
          joined_at?: string | null
          user_id: string
        }
        Update: {
          call_session_id?: string
          created_at?: string
          id?: string
          invite_status?: Database["public"]["Enums"]["call_invite_status"]
          joined_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "call_session_participants_call_session_id_fkey"
            columns: ["call_session_id"]
            isOneToOne: false
            referencedRelation: "call_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      call_sessions: {
        Row: {
          call_type: Database["public"]["Enums"]["call_type"]
          callee_id: string | null
          caller_id: string
          conversation_id: string
          created_at: string
          ended_at: string | null
          id: string
          is_group: boolean
          livekit_room_name: string
          started_at: string | null
          status: Database["public"]["Enums"]["call_status"]
          updated_at: string
        }
        Insert: {
          call_type: Database["public"]["Enums"]["call_type"]
          callee_id?: string | null
          caller_id: string
          conversation_id: string
          created_at?: string
          ended_at?: string | null
          id?: string
          is_group?: boolean
          livekit_room_name: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["call_status"]
          updated_at?: string
        }
        Update: {
          call_type?: Database["public"]["Enums"]["call_type"]
          callee_id?: string | null
          caller_id?: string
          conversation_id?: string
          created_at?: string
          ended_at?: string | null
          id?: string
          is_group?: boolean
          livekit_room_name?: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["call_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "call_sessions_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      call_signals: {
        Row: {
          call_id: string
          created_at: string | null
          id: string
          sender_id: string
          signal_data: string
          signal_type: string
        }
        Insert: {
          call_id: string
          created_at?: string | null
          id?: string
          sender_id: string
          signal_data: string
          signal_type: string
        }
        Update: {
          call_id?: string
          created_at?: string | null
          id?: string
          sender_id?: string
          signal_data?: string
          signal_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "call_signals_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "calls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_signals_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      calls: {
        Row: {
          call_type: string
          caller_id: string
          conversation_id: string | null
          created_at: string | null
          duration: number | null
          ended_at: string | null
          id: string
          meeting_code: string | null
          receiver_id: string
          started_at: string | null
          status: string
          updated_at: string | null
        }
        Insert: {
          call_type: string
          caller_id: string
          conversation_id?: string | null
          created_at?: string | null
          duration?: number | null
          ended_at?: string | null
          id?: string
          meeting_code?: string | null
          receiver_id: string
          started_at?: string | null
          status?: string
          updated_at?: string | null
        }
        Update: {
          call_type?: string
          caller_id?: string
          conversation_id?: string | null
          created_at?: string | null
          duration?: number | null
          ended_at?: string | null
          id?: string
          meeting_code?: string | null
          receiver_id?: string
          started_at?: string | null
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "calls_caller_id_fkey"
            columns: ["caller_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calls_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calls_receiver_id_fkey"
            columns: ["receiver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      carrier_services: {
        Row: {
          api_endpoint: string | null
          api_version: string | null
          base_cost: number | null
          carrier_code: string
          carrier_logo_url: string | null
          carrier_name: string
          cost_per_kg: number | null
          created_at: string
          cutoff_time: string | null
          domestic_coverage: boolean | null
          id: string
          insurance_available: boolean | null
          international_coverage: boolean | null
          is_active: boolean | null
          is_expedited: boolean | null
          is_ground: boolean | null
          is_international: boolean | null
          is_overnight: boolean | null
          max_delivery_days: number | null
          max_dimensions_cm: string | null
          max_weight_kg: number | null
          min_delivery_days: number | null
          requires_signature: boolean | null
          restricted_areas: Json | null
          service_code: string
          service_description: string | null
          service_metadata: Json
          service_name: string
          signature_available: boolean | null
          supported_countries: Json | null
          tracking_url_template: string | null
          updated_at: string
        }
        Insert: {
          api_endpoint?: string | null
          api_version?: string | null
          base_cost?: number | null
          carrier_code: string
          carrier_logo_url?: string | null
          carrier_name: string
          cost_per_kg?: number | null
          created_at?: string
          cutoff_time?: string | null
          domestic_coverage?: boolean | null
          id?: string
          insurance_available?: boolean | null
          international_coverage?: boolean | null
          is_active?: boolean | null
          is_expedited?: boolean | null
          is_ground?: boolean | null
          is_international?: boolean | null
          is_overnight?: boolean | null
          max_delivery_days?: number | null
          max_dimensions_cm?: string | null
          max_weight_kg?: number | null
          min_delivery_days?: number | null
          requires_signature?: boolean | null
          restricted_areas?: Json | null
          service_code: string
          service_description?: string | null
          service_metadata?: Json
          service_name: string
          signature_available?: boolean | null
          supported_countries?: Json | null
          tracking_url_template?: string | null
          updated_at?: string
        }
        Update: {
          api_endpoint?: string | null
          api_version?: string | null
          base_cost?: number | null
          carrier_code?: string
          carrier_logo_url?: string | null
          carrier_name?: string
          cost_per_kg?: number | null
          created_at?: string
          cutoff_time?: string | null
          domestic_coverage?: boolean | null
          id?: string
          insurance_available?: boolean | null
          international_coverage?: boolean | null
          is_active?: boolean | null
          is_expedited?: boolean | null
          is_ground?: boolean | null
          is_international?: boolean | null
          is_overnight?: boolean | null
          max_delivery_days?: number | null
          max_dimensions_cm?: string | null
          max_weight_kg?: number | null
          min_delivery_days?: number | null
          requires_signature?: boolean | null
          restricted_areas?: Json | null
          service_code?: string
          service_description?: string | null
          service_metadata?: Json
          service_name?: string
          signature_available?: boolean | null
          supported_countries?: Json | null
          tracking_url_template?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      cart_discounts: {
        Row: {
          applied_to_category: string | null
          applied_to_listing_id: string | null
          applies_to: string
          calculated_discount_amount: number
          cart_id: string
          created_at: string
          discount_name: string
          discount_profile_id: string
          discount_type: string
          discount_value: number
          id: string
          updated_at: string
        }
        Insert: {
          applied_to_category?: string | null
          applied_to_listing_id?: string | null
          applies_to: string
          calculated_discount_amount?: number
          cart_id: string
          created_at?: string
          discount_name: string
          discount_profile_id: string
          discount_type: string
          discount_value: number
          id?: string
          updated_at?: string
        }
        Update: {
          applied_to_category?: string | null
          applied_to_listing_id?: string | null
          applies_to?: string
          calculated_discount_amount?: number
          cart_id?: string
          created_at?: string
          discount_name?: string
          discount_profile_id?: string
          discount_type?: string
          discount_value?: number
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cart_discounts_applied_to_listing_id_fkey"
            columns: ["applied_to_listing_id"]
            isOneToOne: false
            referencedRelation: "active_listings_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cart_discounts_applied_to_listing_id_fkey"
            columns: ["applied_to_listing_id"]
            isOneToOne: false
            referencedRelation: "active_listings_with_shop"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cart_discounts_applied_to_listing_id_fkey"
            columns: ["applied_to_listing_id"]
            isOneToOne: false
            referencedRelation: "listing_details_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cart_discounts_applied_to_listing_id_fkey"
            columns: ["applied_to_listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cart_discounts_cart_id_fkey"
            columns: ["cart_id"]
            isOneToOne: false
            referencedRelation: "carts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cart_discounts_discount_profile_id_fkey"
            columns: ["discount_profile_id"]
            isOneToOne: false
            referencedRelation: "discount_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cart_items: {
        Row: {
          cart_id: string
          created_at: string
          id: string
          image_url: string | null
          item_metadata: Json
          listing_id: string
          quantity: number
          saved_for_later: boolean
          shop_id: string
          shop_name: string
          title: string
          total_price: number | null
          unit_price: number
          updated_at: string
          variant_id: string | null
          variant_name: string | null
          variant_sku: string | null
          variant_value: string | null
        }
        Insert: {
          cart_id: string
          created_at?: string
          id?: string
          image_url?: string | null
          item_metadata?: Json
          listing_id: string
          quantity: number
          saved_for_later?: boolean
          shop_id: string
          shop_name: string
          title: string
          total_price?: number | null
          unit_price: number
          updated_at?: string
          variant_id?: string | null
          variant_name?: string | null
          variant_sku?: string | null
          variant_value?: string | null
        }
        Update: {
          cart_id?: string
          created_at?: string
          id?: string
          image_url?: string | null
          item_metadata?: Json
          listing_id?: string
          quantity?: number
          saved_for_later?: boolean
          shop_id?: string
          shop_name?: string
          title?: string
          total_price?: number | null
          unit_price?: number
          updated_at?: string
          variant_id?: string | null
          variant_name?: string | null
          variant_sku?: string | null
          variant_value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cart_items_cart_id_fkey"
            columns: ["cart_id"]
            isOneToOne: false
            referencedRelation: "carts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cart_items_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "active_listings_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cart_items_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "active_listings_with_shop"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cart_items_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listing_details_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cart_items_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cart_items_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "active_listings_view"
            referencedColumns: ["shop_id"]
          },
          {
            foreignKeyName: "cart_items_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "payment_analytics"
            referencedColumns: ["shop_id"]
          },
          {
            foreignKeyName: "cart_items_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shop_listings_summary"
            referencedColumns: ["shop_id"]
          },
          {
            foreignKeyName: "cart_items_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cart_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "listing_variations"
            referencedColumns: ["id"]
          },
        ]
      }
      cart_reminder_log: {
        Row: {
          cart_id: string
          created_at: string
          id: string
          notification_id: string | null
          stage: number
          user_id: string
        }
        Insert: {
          cart_id: string
          created_at?: string
          id?: string
          notification_id?: string | null
          stage: number
          user_id: string
        }
        Update: {
          cart_id?: string
          created_at?: string
          id?: string
          notification_id?: string | null
          stage?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cart_reminder_log_cart_id_fkey"
            columns: ["cart_id"]
            isOneToOne: false
            referencedRelation: "carts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cart_reminder_log_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "notifications"
            referencedColumns: ["id"]
          },
        ]
      }
      carts: {
        Row: {
          applied_discount_id: string | null
          applied_discount_name: string | null
          applied_discount_type: string | null
          applied_discount_value: number | null
          cart_metadata: Json
          converted_at: string | null
          created_at: string
          currency: string
          discount_amount: number
          expires_at: string
          id: string
          items_subtotal: number
          last_activity_at: string
          session_id: string | null
          status: Database["public"]["Enums"]["cart_status_enum"]
          total_amount: number
          updated_at: string
          user_id: string | null
        }
        Insert: {
          applied_discount_id?: string | null
          applied_discount_name?: string | null
          applied_discount_type?: string | null
          applied_discount_value?: number | null
          cart_metadata?: Json
          converted_at?: string | null
          created_at?: string
          currency?: string
          discount_amount?: number
          expires_at?: string
          id?: string
          items_subtotal?: number
          last_activity_at?: string
          session_id?: string | null
          status?: Database["public"]["Enums"]["cart_status_enum"]
          total_amount?: number
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          applied_discount_id?: string | null
          applied_discount_name?: string | null
          applied_discount_type?: string | null
          applied_discount_value?: number | null
          cart_metadata?: Json
          converted_at?: string | null
          created_at?: string
          currency?: string
          discount_amount?: number
          expires_at?: string
          id?: string
          items_subtotal?: number
          last_activity_at?: string
          session_id?: string | null
          status?: Database["public"]["Enums"]["cart_status_enum"]
          total_amount?: number
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "carts_applied_discount_id_fkey"
            columns: ["applied_discount_id"]
            isOneToOne: false
            referencedRelation: "discount_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          category: string
          category_icon: string | null
          category_id: string
          category_image_url: string | null
          category_meta: Json | null
          created_at: string
          description: string | null
          id_path: string | null
          lang_code: string
          level: number | null
          main_pair: Json | null
          meta_description: string | null
          meta_keywords: string | null
          meta_title: string | null
          og_image: string | null
          page_title: string | null
          parent_id: string | null
          position: number | null
          product_count: number | null
          seo_name: string | null
          seo_path: string | null
          status: Database["public"]["Enums"]["category_status_enum"]
          timestamp: number | null
          updated_at: string
        }
        Insert: {
          category: string
          category_icon?: string | null
          category_id?: string
          category_image_url?: string | null
          category_meta?: Json | null
          created_at?: string
          description?: string | null
          id_path?: string | null
          lang_code?: string
          level?: number | null
          main_pair?: Json | null
          meta_description?: string | null
          meta_keywords?: string | null
          meta_title?: string | null
          og_image?: string | null
          page_title?: string | null
          parent_id?: string | null
          position?: number | null
          product_count?: number | null
          seo_name?: string | null
          seo_path?: string | null
          status?: Database["public"]["Enums"]["category_status_enum"]
          timestamp?: number | null
          updated_at?: string
        }
        Update: {
          category?: string
          category_icon?: string | null
          category_id?: string
          category_image_url?: string | null
          category_meta?: Json | null
          created_at?: string
          description?: string | null
          id_path?: string | null
          lang_code?: string
          level?: number | null
          main_pair?: Json | null
          meta_description?: string | null
          meta_keywords?: string | null
          meta_title?: string | null
          og_image?: string | null
          page_title?: string | null
          parent_id?: string | null
          position?: number | null
          product_count?: number | null
          seo_name?: string | null
          seo_path?: string | null
          status?: Database["public"]["Enums"]["category_status_enum"]
          timestamp?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["category_id"]
          },
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories_with_counts"
            referencedColumns: ["category_id"]
          },
        ]
      }
      category_assignments: {
        Row: {
          assigned_by: string | null
          category_id: string
          created_at: string
          id: string
          is_primary: boolean
          listing_id: string
        }
        Insert: {
          assigned_by?: string | null
          category_id: string
          created_at?: string
          id?: string
          is_primary?: boolean
          listing_id: string
        }
        Update: {
          assigned_by?: string | null
          category_id?: string
          created_at?: string
          id?: string
          is_primary?: boolean
          listing_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "category_assignments_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["category_id"]
          },
          {
            foreignKeyName: "category_assignments_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories_with_counts"
            referencedColumns: ["category_id"]
          },
          {
            foreignKeyName: "category_assignments_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "active_listings_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "category_assignments_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "active_listings_with_shop"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "category_assignments_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listing_details_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "category_assignments_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      category_translations: {
        Row: {
          category: string
          category_id: string
          created_at: string
          description: string | null
          id: string
          lang_code: string
          meta_description: string | null
          meta_keywords: string | null
          page_title: string | null
          updated_at: string
        }
        Insert: {
          category: string
          category_id: string
          created_at?: string
          description?: string | null
          id?: string
          lang_code: string
          meta_description?: string | null
          meta_keywords?: string | null
          page_title?: string | null
          updated_at?: string
        }
        Update: {
          category?: string
          category_id?: string
          created_at?: string
          description?: string | null
          id?: string
          lang_code?: string
          meta_description?: string | null
          meta_keywords?: string | null
          page_title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "category_translations_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["category_id"]
          },
          {
            foreignKeyName: "category_translations_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories_with_counts"
            referencedColumns: ["category_id"]
          },
        ]
      }
      chat_message: {
        Row: {
          body: string
          created_at: string
          id: string
          sender_id: string
          thread_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          sender_id: string
          thread_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          sender_id?: string
          thread_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_message_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "chat_thread"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_routing_rules: {
        Row: {
          agent_criteria: Json | null
          conditions: Json
          created_at: string
          id: string
          is_active: boolean | null
          priority: number | null
          rule_name: string
          updated_at: string
        }
        Insert: {
          agent_criteria?: Json | null
          conditions: Json
          created_at?: string
          id?: string
          is_active?: boolean | null
          priority?: number | null
          rule_name: string
          updated_at?: string
        }
        Update: {
          agent_criteria?: Json | null
          conditions?: Json
          created_at?: string
          id?: string
          is_active?: boolean | null
          priority?: number | null
          rule_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      chat_thread: {
        Row: {
          created_at: string
          id: string
          last_message_at: string | null
          user_a_id: string
          user_b_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_message_at?: string | null
          user_a_id: string
          user_b_id: string
        }
        Update: {
          created_at?: string
          id?: string
          last_message_at?: string | null
          user_a_id?: string
          user_b_id?: string
        }
        Relationships: []
      }
      checkout_phone_verifications: {
        Row: {
          attempts: number
          code_hash: string
          created_at: string
          expires_at: string
          last_sent_at: string
          phone: string
          send_count: number
          send_window_started_at: string | null
          user_id: string
          verified_at: string | null
        }
        Insert: {
          attempts?: number
          code_hash: string
          created_at?: string
          expires_at: string
          last_sent_at?: string
          phone: string
          send_count?: number
          send_window_started_at?: string | null
          user_id: string
          verified_at?: string | null
        }
        Update: {
          attempts?: number
          code_hash?: string
          created_at?: string
          expires_at?: string
          last_sent_at?: string
          phone?: string
          send_count?: number
          send_window_started_at?: string | null
          user_id?: string
          verified_at?: string | null
        }
        Relationships: []
      }
      class_course: {
        Row: {
          cover_image: string | null
          created_at: string
          description: string | null
          id: string
          is_published: boolean
          slug: string
          title: string
          updated_at: string | null
        }
        Insert: {
          cover_image?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_published?: boolean
          slug: string
          title: string
          updated_at?: string | null
        }
        Update: {
          cover_image?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_published?: boolean
          slug?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      class_enrollment: {
        Row: {
          course_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          course_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          course_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_enrollment_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "class_course"
            referencedColumns: ["id"]
          },
        ]
      }
      class_lesson: {
        Row: {
          content: string | null
          course_id: string
          created_at: string
          id: string
          sort_order: number
          title: string
        }
        Insert: {
          content?: string | null
          course_id: string
          created_at?: string
          id?: string
          sort_order?: number
          title: string
        }
        Update: {
          content?: string | null
          course_id?: string
          created_at?: string
          id?: string
          sort_order?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_lesson_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "class_course"
            referencedColumns: ["id"]
          },
        ]
      }
      cms_blog_comments: {
        Row: {
          author_id: string
          body: string
          content_id: string
          created_at: string
          deleted_at: string | null
          id: string
          is_approved: boolean
          is_flagged: boolean
          parent_id: string | null
          updated_at: string
        }
        Insert: {
          author_id: string
          body: string
          content_id: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_approved?: boolean
          is_flagged?: boolean
          parent_id?: string | null
          updated_at?: string
        }
        Update: {
          author_id?: string
          body?: string
          content_id?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_approved?: boolean
          is_flagged?: boolean
          parent_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cms_blog_comments_author_id_fkey1"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cms_blog_comments_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "cms_content"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cms_blog_comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "cms_blog_comments"
            referencedColumns: ["id"]
          },
        ]
      }
      cms_blog_likes: {
        Row: {
          content_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          content_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          content_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cms_blog_likes_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "cms_content"
            referencedColumns: ["id"]
          },
        ]
      }
      cms_categories: {
        Row: {
          cover_url: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          name: string
          parent_id: string | null
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          cover_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          parent_id?: string | null
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          cover_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          parent_id?: string | null
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cms_categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "cms_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      cms_content: {
        Row: {
          allow_comments: boolean
          author_id: string
          body: string | null
          body_format: string
          canonical_url: string | null
          category_id: string | null
          comment_count: number
          cover_image_id: string | null
          created_at: string
          deleted_at: string | null
          excerpt: string | null
          focus_keyword: string | null
          id: string
          is_featured: boolean
          like_count: number
          metadata: Json
          og_description: string | null
          og_image_id: string | null
          og_title: string | null
          og_type: string | null
          published_at: string | null
          robots_extra: string | null
          robots_follow: boolean
          robots_index: boolean
          scheduled_at: string | null
          schema_org: Json
          seo_description: string | null
          seo_keywords: string[] | null
          seo_score: number | null
          seo_title: string | null
          sitemap_changefreq: string | null
          sitemap_exclude: boolean
          sitemap_priority: number | null
          slug: string
          status: Database["public"]["Enums"]["cms_content_status"]
          title: string
          twitter_card: string | null
          twitter_description: string | null
          twitter_image_id: string | null
          twitter_title: string | null
          type: Database["public"]["Enums"]["cms_content_type"]
          updated_at: string
          vendor_id: string | null
          view_count: number
        }
        Insert: {
          allow_comments?: boolean
          author_id: string
          body?: string | null
          body_format?: string
          canonical_url?: string | null
          category_id?: string | null
          comment_count?: number
          cover_image_id?: string | null
          created_at?: string
          deleted_at?: string | null
          excerpt?: string | null
          focus_keyword?: string | null
          id?: string
          is_featured?: boolean
          like_count?: number
          metadata?: Json
          og_description?: string | null
          og_image_id?: string | null
          og_title?: string | null
          og_type?: string | null
          published_at?: string | null
          robots_extra?: string | null
          robots_follow?: boolean
          robots_index?: boolean
          scheduled_at?: string | null
          schema_org?: Json
          seo_description?: string | null
          seo_keywords?: string[] | null
          seo_score?: number | null
          seo_title?: string | null
          sitemap_changefreq?: string | null
          sitemap_exclude?: boolean
          sitemap_priority?: number | null
          slug: string
          status?: Database["public"]["Enums"]["cms_content_status"]
          title: string
          twitter_card?: string | null
          twitter_description?: string | null
          twitter_image_id?: string | null
          twitter_title?: string | null
          type?: Database["public"]["Enums"]["cms_content_type"]
          updated_at?: string
          vendor_id?: string | null
          view_count?: number
        }
        Update: {
          allow_comments?: boolean
          author_id?: string
          body?: string | null
          body_format?: string
          canonical_url?: string | null
          category_id?: string | null
          comment_count?: number
          cover_image_id?: string | null
          created_at?: string
          deleted_at?: string | null
          excerpt?: string | null
          focus_keyword?: string | null
          id?: string
          is_featured?: boolean
          like_count?: number
          metadata?: Json
          og_description?: string | null
          og_image_id?: string | null
          og_title?: string | null
          og_type?: string | null
          published_at?: string | null
          robots_extra?: string | null
          robots_follow?: boolean
          robots_index?: boolean
          scheduled_at?: string | null
          schema_org?: Json
          seo_description?: string | null
          seo_keywords?: string[] | null
          seo_score?: number | null
          seo_title?: string | null
          sitemap_changefreq?: string | null
          sitemap_exclude?: boolean
          sitemap_priority?: number | null
          slug?: string
          status?: Database["public"]["Enums"]["cms_content_status"]
          title?: string
          twitter_card?: string | null
          twitter_description?: string | null
          twitter_image_id?: string | null
          twitter_title?: string | null
          type?: Database["public"]["Enums"]["cms_content_type"]
          updated_at?: string
          vendor_id?: string | null
          view_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "cms_content_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "cms_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cms_content_cover_image_id_fkey"
            columns: ["cover_image_id"]
            isOneToOne: false
            referencedRelation: "cms_media"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cms_content_og_image_id_fkey"
            columns: ["og_image_id"]
            isOneToOne: false
            referencedRelation: "cms_media"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cms_content_twitter_image_id_fkey"
            columns: ["twitter_image_id"]
            isOneToOne: false
            referencedRelation: "cms_media"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cms_content_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cms_content_media: {
        Row: {
          content_id: string
          id: string
          media_id: string
          sort_order: number
        }
        Insert: {
          content_id: string
          id?: string
          media_id: string
          sort_order?: number
        }
        Update: {
          content_id?: string
          id?: string
          media_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "cms_content_media_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "cms_content"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cms_content_media_media_id_fkey"
            columns: ["media_id"]
            isOneToOne: false
            referencedRelation: "cms_media"
            referencedColumns: ["id"]
          },
        ]
      }
      cms_content_tag_map: {
        Row: {
          content_id: string
          tag_id: string
        }
        Insert: {
          content_id: string
          tag_id: string
        }
        Update: {
          content_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cms_content_tag_map_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "cms_content"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cms_content_tag_map_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "cms_tags"
            referencedColumns: ["id"]
          },
        ]
      }
      cms_content_versions: {
        Row: {
          body: string | null
          body_format: string
          change_note: string | null
          content_id: string
          created_at: string
          id: string
          saved_by: string | null
          status: Database["public"]["Enums"]["cms_content_status"]
          title: string
          version_no: number
        }
        Insert: {
          body?: string | null
          body_format?: string
          change_note?: string | null
          content_id: string
          created_at?: string
          id?: string
          saved_by?: string | null
          status: Database["public"]["Enums"]["cms_content_status"]
          title: string
          version_no: number
        }
        Update: {
          body?: string | null
          body_format?: string
          change_note?: string | null
          content_id?: string
          created_at?: string
          id?: string
          saved_by?: string | null
          status?: Database["public"]["Enums"]["cms_content_status"]
          title?: string
          version_no?: number
        }
        Relationships: [
          {
            foreignKeyName: "cms_content_versions_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "cms_content"
            referencedColumns: ["id"]
          },
        ]
      }
      cms_media: {
        Row: {
          alt_text: string | null
          bucket_id: string
          caption: string | null
          created_at: string
          file_name: string
          file_size: number
          folder: string
          height: number | null
          id: string
          is_active: boolean
          media_type: Database["public"]["Enums"]["cms_media_type"]
          mime_type: string
          public_url: string | null
          storage_path: string
          updated_at: string
          uploaded_by: string | null
          width: number | null
        }
        Insert: {
          alt_text?: string | null
          bucket_id: string
          caption?: string | null
          created_at?: string
          file_name: string
          file_size: number
          folder?: string
          height?: number | null
          id?: string
          is_active?: boolean
          media_type?: Database["public"]["Enums"]["cms_media_type"]
          mime_type: string
          public_url?: string | null
          storage_path: string
          updated_at?: string
          uploaded_by?: string | null
          width?: number | null
        }
        Update: {
          alt_text?: string | null
          bucket_id?: string
          caption?: string | null
          created_at?: string
          file_name?: string
          file_size?: number
          folder?: string
          height?: number | null
          id?: string
          is_active?: boolean
          media_type?: Database["public"]["Enums"]["cms_media_type"]
          mime_type?: string
          public_url?: string | null
          storage_path?: string
          updated_at?: string
          uploaded_by?: string | null
          width?: number | null
        }
        Relationships: []
      }
      cms_seo: {
        Row: {
          canonical_url: string | null
          category_id: string | null
          content_id: string | null
          created_at: string
          created_by: string | null
          custom_path: string | null
          focus_keyword: string | null
          id: string
          meta_description: string | null
          meta_title: string
          og_description: string | null
          og_image_id: string | null
          og_title: string | null
          og_type: string | null
          robots_extra: string | null
          robots_follow: boolean
          robots_index: boolean
          schema_org: Json
          seo_score: number | null
          sitemap_changefreq: string | null
          sitemap_exclude: boolean
          sitemap_priority: number | null
          twitter_card: string | null
          twitter_description: string | null
          twitter_image_id: string | null
          twitter_title: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          canonical_url?: string | null
          category_id?: string | null
          content_id?: string | null
          created_at?: string
          created_by?: string | null
          custom_path?: string | null
          focus_keyword?: string | null
          id?: string
          meta_description?: string | null
          meta_title: string
          og_description?: string | null
          og_image_id?: string | null
          og_title?: string | null
          og_type?: string | null
          robots_extra?: string | null
          robots_follow?: boolean
          robots_index?: boolean
          schema_org?: Json
          seo_score?: number | null
          sitemap_changefreq?: string | null
          sitemap_exclude?: boolean
          sitemap_priority?: number | null
          twitter_card?: string | null
          twitter_description?: string | null
          twitter_image_id?: string | null
          twitter_title?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          canonical_url?: string | null
          category_id?: string | null
          content_id?: string | null
          created_at?: string
          created_by?: string | null
          custom_path?: string | null
          focus_keyword?: string | null
          id?: string
          meta_description?: string | null
          meta_title?: string
          og_description?: string | null
          og_image_id?: string | null
          og_title?: string | null
          og_type?: string | null
          robots_extra?: string | null
          robots_follow?: boolean
          robots_index?: boolean
          schema_org?: Json
          seo_score?: number | null
          sitemap_changefreq?: string | null
          sitemap_exclude?: boolean
          sitemap_priority?: number | null
          twitter_card?: string | null
          twitter_description?: string | null
          twitter_image_id?: string | null
          twitter_title?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cms_seo_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: true
            referencedRelation: "cms_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cms_seo_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: true
            referencedRelation: "cms_content"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cms_seo_og_image_id_fkey"
            columns: ["og_image_id"]
            isOneToOne: false
            referencedRelation: "cms_media"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cms_seo_twitter_image_id_fkey"
            columns: ["twitter_image_id"]
            isOneToOne: false
            referencedRelation: "cms_media"
            referencedColumns: ["id"]
          },
        ]
      }
      cms_seo_redirects: {
        Row: {
          created_at: string
          created_by: string | null
          from_path: string
          hit_count: number
          id: string
          is_active: boolean
          note: string | null
          redirect_code: number
          to_path: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          from_path: string
          hit_count?: number
          id?: string
          is_active?: boolean
          note?: string | null
          redirect_code?: number
          to_path?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          from_path?: string
          hit_count?: number
          id?: string
          is_active?: boolean
          note?: string | null
          redirect_code?: number
          to_path?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      cms_tags: {
        Row: {
          created_at: string
          id: string
          name: string
          slug: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          slug: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          slug?: string
        }
        Relationships: []
      }
      collections: {
        Row: {
          created_at: string | null
          id: string
          is_default: boolean | null
          name: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_default?: boolean | null
          name: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_default?: boolean | null
          name?: string
          user_id?: string | null
        }
        Relationships: []
      }
      comment_likes: {
        Row: {
          comment_id: string
          created_at: string | null
          id: string
          raw_db_comment_reaction: Json | null
          raw_db_reply_reaction: Json | null
          reaction_type: string
          user_id: string
        }
        Insert: {
          comment_id: string
          created_at?: string | null
          id?: string
          raw_db_comment_reaction?: Json | null
          raw_db_reply_reaction?: Json | null
          reaction_type?: string
          user_id: string
        }
        Update: {
          comment_id?: string
          created_at?: string | null
          id?: string
          raw_db_comment_reaction?: Json | null
          raw_db_reply_reaction?: Json | null
          reaction_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comment_likes_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comment_likes_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "comments_with_stats"
            referencedColumns: ["id"]
          },
        ]
      }
      comments: {
        Row: {
          content: string
          created_at: string | null
          id: string
          is_deleted: boolean | null
          is_edited: boolean | null
          like_count: number | null
          media_urls: string[] | null
          mentions: string[] | null
          parent_comment_id: string | null
          post_id: string
          raw_db_comment: Json | null
          raw_db_comment_reply: Json | null
          reply_count: number | null
          thread_level: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          is_deleted?: boolean | null
          is_edited?: boolean | null
          like_count?: number | null
          media_urls?: string[] | null
          mentions?: string[] | null
          parent_comment_id?: string | null
          post_id: string
          raw_db_comment?: Json | null
          raw_db_comment_reply?: Json | null
          reply_count?: number | null
          thread_level?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          is_deleted?: boolean | null
          is_edited?: boolean | null
          like_count?: number | null
          media_urls?: string[] | null
          mentions?: string[] | null
          parent_comment_id?: string | null
          post_id?: string
          raw_db_comment?: Json | null
          raw_db_comment_reply?: Json | null
          reply_count?: number | null
          thread_level?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_parent_comment_id_fkey"
            columns: ["parent_comment_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_parent_comment_id_fkey"
            columns: ["parent_comment_id"]
            isOneToOne: false
            referencedRelation: "comments_with_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts_with_stats"
            referencedColumns: ["id"]
          },
        ]
      }
      commerce_category: {
        Row: {
          created_at: string
          description: string | null
          id: string
          image: string | null
          name: string
          slug: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          image?: string | null
          name: string
          slug: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          image?: string | null
          name?: string
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      commerce_checkout_groups: {
        Row: {
          buyer_id: string
          cancelled_at: string | null
          cart_id: string
          created_at: string
          currency: string
          discount_amount: number
          expires_at: string
          id: string
          idempotency_key: string
          last_error: string | null
          order_ids: string[]
          paid_at: string | null
          payment_mode: string
          selected_cart_item_ids: string[]
          status: string
          subtotal_amount: number
          total_amount: number
          updated_at: string
        }
        Insert: {
          buyer_id: string
          cancelled_at?: string | null
          cart_id: string
          created_at?: string
          currency?: string
          discount_amount?: number
          expires_at?: string
          id?: string
          idempotency_key: string
          last_error?: string | null
          order_ids?: string[]
          paid_at?: string | null
          payment_mode: string
          selected_cart_item_ids?: string[]
          status?: string
          subtotal_amount?: number
          total_amount?: number
          updated_at?: string
        }
        Update: {
          buyer_id?: string
          cancelled_at?: string | null
          cart_id?: string
          created_at?: string
          currency?: string
          discount_amount?: number
          expires_at?: string
          id?: string
          idempotency_key?: string
          last_error?: string | null
          order_ids?: string[]
          paid_at?: string | null
          payment_mode?: string
          selected_cart_item_ids?: string[]
          status?: string
          subtotal_amount?: number
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "commerce_checkout_groups_cart_id_fkey"
            columns: ["cart_id"]
            isOneToOne: false
            referencedRelation: "carts"
            referencedColumns: ["id"]
          },
        ]
      }
      commerce_checkout_payment_steps: {
        Row: {
          amount: number
          attempt_count: number
          checkout_group_id: string
          checkout_url: string | null
          collection: string
          created_at: string
          currency: string
          id: string
          idempotency_key: string
          kind: string
          last_error: string | null
          metadata: Json
          order_id: string | null
          processed_at: string | null
          provider: string | null
          provider_reference: string | null
          shop_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          amount: number
          attempt_count?: number
          checkout_group_id: string
          checkout_url?: string | null
          collection: string
          created_at?: string
          currency?: string
          id?: string
          idempotency_key: string
          kind?: string
          last_error?: string | null
          metadata?: Json
          order_id?: string | null
          processed_at?: string | null
          provider?: string | null
          provider_reference?: string | null
          shop_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          attempt_count?: number
          checkout_group_id?: string
          checkout_url?: string | null
          collection?: string
          created_at?: string
          currency?: string
          id?: string
          idempotency_key?: string
          kind?: string
          last_error?: string | null
          metadata?: Json
          order_id?: string | null
          processed_at?: string | null
          provider?: string | null
          provider_reference?: string | null
          shop_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "commerce_checkout_payment_steps_checkout_group_id_fkey"
            columns: ["checkout_group_id"]
            isOneToOne: false
            referencedRelation: "commerce_checkout_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commerce_checkout_payment_steps_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "customer_order_history_view"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "commerce_checkout_payment_steps_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "customer_orders_view"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "commerce_checkout_payment_steps_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commerce_checkout_payment_steps_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "active_listings_view"
            referencedColumns: ["shop_id"]
          },
          {
            foreignKeyName: "commerce_checkout_payment_steps_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "payment_analytics"
            referencedColumns: ["shop_id"]
          },
          {
            foreignKeyName: "commerce_checkout_payment_steps_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shop_listings_summary"
            referencedColumns: ["shop_id"]
          },
          {
            foreignKeyName: "commerce_checkout_payment_steps_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      commerce_checkout_payments: {
        Row: {
          amount: number
          checkout_url: string | null
          created_at: string
          currency: string
          gateway_order_id: string | null
          gateway_payment_id: string | null
          id: string
          metadata: Json
          order_id: string
          payment_gateway: string | null
          payment_rail: string
          platform_fee_amount: number
          seller_receives_amount: number
          shop_id: string
          status: string
          updated_at: string
        }
        Insert: {
          amount?: number
          checkout_url?: string | null
          created_at?: string
          currency?: string
          gateway_order_id?: string | null
          gateway_payment_id?: string | null
          id?: string
          metadata?: Json
          order_id: string
          payment_gateway?: string | null
          payment_rail: string
          platform_fee_amount?: number
          seller_receives_amount?: number
          shop_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          checkout_url?: string | null
          created_at?: string
          currency?: string
          gateway_order_id?: string | null
          gateway_payment_id?: string | null
          id?: string
          metadata?: Json
          order_id?: string
          payment_gateway?: string | null
          payment_rail?: string
          platform_fee_amount?: number
          seller_receives_amount?: number
          shop_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "commerce_checkout_payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "customer_order_history_view"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "commerce_checkout_payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "customer_orders_view"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "commerce_checkout_payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commerce_checkout_payments_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "active_listings_view"
            referencedColumns: ["shop_id"]
          },
          {
            foreignKeyName: "commerce_checkout_payments_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "payment_analytics"
            referencedColumns: ["shop_id"]
          },
          {
            foreignKeyName: "commerce_checkout_payments_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shop_listings_summary"
            referencedColumns: ["shop_id"]
          },
          {
            foreignKeyName: "commerce_checkout_payments_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      commerce_checkout_shipments: {
        Row: {
          created_at: string
          id: string
          metadata: Json
          order_id: string
          partner_shipment_id: string | null
          platform_fee_amount: number
          shipping_partner: string | null
          shipping_rail: string
          shop_id: string
          sync_status: string
          tracking_number: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          metadata?: Json
          order_id: string
          partner_shipment_id?: string | null
          platform_fee_amount?: number
          shipping_partner?: string | null
          shipping_rail: string
          shop_id: string
          sync_status?: string
          tracking_number?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          metadata?: Json
          order_id?: string
          partner_shipment_id?: string | null
          platform_fee_amount?: number
          shipping_partner?: string | null
          shipping_rail?: string
          shop_id?: string
          sync_status?: string
          tracking_number?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "commerce_checkout_shipments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "customer_order_history_view"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "commerce_checkout_shipments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "customer_orders_view"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "commerce_checkout_shipments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commerce_checkout_shipments_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "active_listings_view"
            referencedColumns: ["shop_id"]
          },
          {
            foreignKeyName: "commerce_checkout_shipments_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "payment_analytics"
            referencedColumns: ["shop_id"]
          },
          {
            foreignKeyName: "commerce_checkout_shipments_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shop_listings_summary"
            referencedColumns: ["shop_id"]
          },
          {
            foreignKeyName: "commerce_checkout_shipments_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      commerce_favorite: {
        Row: {
          created_at: string
          id: string
          listing_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          listing_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          listing_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "commerce_favorite_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "commerce_listing"
            referencedColumns: ["id"]
          },
        ]
      }
      commerce_listing: {
        Row: {
          category_id: string | null
          created_at: string
          currency: string
          description: string | null
          id: string
          image: string | null
          price_cents: number
          seller_id: string
          status: string
          title: string
          updated_at: string | null
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          image?: string | null
          price_cents?: number
          seller_id: string
          status?: string
          title: string
          updated_at?: string | null
        }
        Update: {
          category_id?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          image?: string | null
          price_cents?: number
          seller_id?: string
          status?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "commerce_listing_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "commerce_category"
            referencedColumns: ["id"]
          },
        ]
      }
      commerce_listing_image: {
        Row: {
          created_at: string
          id: string
          listing_id: string
          sort_order: number
          url: string
        }
        Insert: {
          created_at?: string
          id?: string
          listing_id: string
          sort_order?: number
          url: string
        }
        Update: {
          created_at?: string
          id?: string
          listing_id?: string
          sort_order?: number
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "commerce_listing_image_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "commerce_listing"
            referencedColumns: ["id"]
          },
        ]
      }
      community_digest_log: {
        Row: {
          created_at: string
          notification_id: string | null
          user_id: string
          week_key: string
        }
        Insert: {
          created_at?: string
          notification_id?: string | null
          user_id: string
          week_key: string
        }
        Update: {
          created_at?: string
          notification_id?: string | null
          user_id?: string
          week_key?: string
        }
        Relationships: []
      }
      community_hidden_posts: {
        Row: {
          created_at: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_hidden_posts_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_hidden_posts_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts_with_stats"
            referencedColumns: ["id"]
          },
        ]
      }
      community_post_reports: {
        Row: {
          created_at: string
          details: string | null
          id: string
          post_id: string
          reason: string
          reporter_id: string
        }
        Insert: {
          created_at?: string
          details?: string | null
          id?: string
          post_id: string
          reason?: string
          reporter_id: string
        }
        Update: {
          created_at?: string
          details?: string | null
          id?: string
          post_id?: string
          reason?: string
          reporter_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_post_reports_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_post_reports_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts_with_stats"
            referencedColumns: ["id"]
          },
        ]
      }
      company_followers: {
        Row: {
          company_id: string
          created_at: string | null
          follower_id: string
          id: string
        }
        Insert: {
          company_id: string
          created_at?: string | null
          follower_id: string
          id?: string
        }
        Update: {
          company_id?: string
          created_at?: string | null
          follower_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_company"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companypages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_follower"
            columns: ["follower_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      company_members: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          id: string
          role: string
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          role: string
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_members_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companypages"
            referencedColumns: ["id"]
          },
        ]
      }
      companypages: {
        Row: {
          community_members: number | null
          cover_url: string | null
          created_at: string
          created_by: string | null
          founded_year: number | null
          headquarters: string | null
          id: string
          industry: string
          location: string | null
          logo_url: string | null
          name: string
          page_category: string
          page_slug: string
          raw_page_data: Json | null
          size: string
          tagline: string | null
          type: string
          website: string | null
        }
        Insert: {
          community_members?: number | null
          cover_url?: string | null
          created_at?: string
          created_by?: string | null
          founded_year?: number | null
          headquarters?: string | null
          id?: string
          industry: string
          location?: string | null
          logo_url?: string | null
          name: string
          page_category?: string
          page_slug: string
          raw_page_data?: Json | null
          size: string
          tagline?: string | null
          type: string
          website?: string | null
        }
        Update: {
          community_members?: number | null
          cover_url?: string | null
          created_at?: string
          created_by?: string | null
          founded_year?: number | null
          headquarters?: string | null
          id?: string
          industry?: string
          location?: string | null
          logo_url?: string | null
          name?: string
          page_category?: string
          page_slug?: string
          raw_page_data?: Json | null
          size?: string
          tagline?: string | null
          type?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "companypages_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      connections: {
        Row: {
          created_at: string
          id: string
          message: string | null
          receiver_id: string
          sender_id: string
          status: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          message?: string | null
          receiver_id: string
          sender_id: string
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          message?: string | null
          receiver_id?: string
          sender_id?: string
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "connections_receiver_id_fkey"
            columns: ["receiver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "connections_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      content_reports: {
        Row: {
          created_at: string
          details: string | null
          entity_id: string
          entity_type: string
          id: string
          reason: string
          reporter_id: string
        }
        Insert: {
          created_at?: string
          details?: string | null
          entity_id: string
          entity_type: string
          id?: string
          reason: string
          reporter_id: string
        }
        Update: {
          created_at?: string
          details?: string | null
          entity_id?: string
          entity_type?: string
          id?: string
          reason?: string
          reporter_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_context: {
        Row: {
          context_data: Json | null
          conversation_summary: string | null
          created_at: string | null
          id: string
          last_query: string | null
          session_id: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          context_data?: Json | null
          conversation_summary?: string | null
          created_at?: string | null
          id?: string
          last_query?: string | null
          session_id: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          context_data?: Json | null
          conversation_summary?: string | null
          created_at?: string | null
          id?: string
          last_query?: string | null
          session_id?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      conversation_participants: {
        Row: {
          cleared_at: string | null
          conversation_id: string | null
          id: string
          is_archived: boolean
          is_muted: boolean
          is_pinned: boolean
          joined_at: string | null
          last_read_at: string | null
          role: string
          user_id: string | null
        }
        Insert: {
          cleared_at?: string | null
          conversation_id?: string | null
          id?: string
          is_archived?: boolean
          is_muted?: boolean
          is_pinned?: boolean
          joined_at?: string | null
          last_read_at?: string | null
          role?: string
          user_id?: string | null
        }
        Update: {
          cleared_at?: string | null
          conversation_id?: string | null
          id?: string
          is_archived?: boolean
          is_muted?: boolean
          is_pinned?: boolean
          joined_at?: string | null
          last_read_at?: string | null
          role?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversation_participants_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          conversation_type: string | null
          created_at: string | null
          disappearing_seconds: number | null
          id: string
          last_message_id: string | null
          members_can_add: boolean
          metadata: Json | null
          owner_id: string | null
          title: string | null
          updated_at: string | null
        }
        Insert: {
          conversation_type?: string | null
          created_at?: string | null
          disappearing_seconds?: number | null
          id?: string
          last_message_id?: string | null
          members_can_add?: boolean
          metadata?: Json | null
          owner_id?: string | null
          title?: string | null
          updated_at?: string | null
        }
        Update: {
          conversation_type?: string | null
          created_at?: string | null
          disappearing_seconds?: number | null
          id?: string
          last_message_id?: string | null
          members_can_add?: boolean
          metadata?: Json | null
          owner_id?: string | null
          title?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_conversations_last_message"
            columns: ["last_message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      cowork_participant: {
        Row: {
          created_at: string
          id: string
          role: string
          room_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: string
          room_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: string
          room_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cowork_participant_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "cowork_room"
            referencedColumns: ["id"]
          },
        ]
      }
      cowork_room: {
        Row: {
          created_at: string
          description: string | null
          ends_at: string | null
          host_id: string
          id: string
          starts_at: string | null
          status: string
          title: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          ends_at?: string | null
          host_id: string
          id?: string
          starts_at?: string | null
          status?: string
          title: string
        }
        Update: {
          created_at?: string
          description?: string | null
          ends_at?: string | null
          host_id?: string
          id?: string
          starts_at?: string | null
          status?: string
          title?: string
        }
        Relationships: []
      }
      custom_shipping_partners: {
        Row: {
          api_endpoint: string | null
          api_key_encrypted: string | null
          contact_person: string | null
          created_at: string | null
          email: string | null
          id: string
          is_verified: boolean | null
          partner_name: string
          phone: string | null
          pickup_address: Json | null
          service_areas: Json | null
          shipping_provider_id: string
          shop_id: string
          tracking_url_template: string | null
          updated_at: string | null
          website: string | null
        }
        Insert: {
          api_endpoint?: string | null
          api_key_encrypted?: string | null
          contact_person?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          is_verified?: boolean | null
          partner_name: string
          phone?: string | null
          pickup_address?: Json | null
          service_areas?: Json | null
          shipping_provider_id: string
          shop_id: string
          tracking_url_template?: string | null
          updated_at?: string | null
          website?: string | null
        }
        Update: {
          api_endpoint?: string | null
          api_key_encrypted?: string | null
          contact_person?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          is_verified?: boolean | null
          partner_name?: string
          phone?: string | null
          pickup_address?: Json | null
          service_areas?: Json | null
          shipping_provider_id?: string
          shop_id?: string
          tracking_url_template?: string | null
          updated_at?: string | null
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "custom_shipping_partners_shipping_provider_id_fkey"
            columns: ["shipping_provider_id"]
            isOneToOne: false
            referencedRelation: "shipping_providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custom_shipping_partners_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "active_listings_view"
            referencedColumns: ["shop_id"]
          },
          {
            foreignKeyName: "custom_shipping_partners_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "payment_analytics"
            referencedColumns: ["shop_id"]
          },
          {
            foreignKeyName: "custom_shipping_partners_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shop_listings_summary"
            referencedColumns: ["shop_id"]
          },
          {
            foreignKeyName: "custom_shipping_partners_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_locations: {
        Row: {
          address_line: string | null
          address_line_2: string | null
          address_type: string
          city: string
          country: string
          created_at: string | null
          full_name: string | null
          id: string
          is_default: boolean | null
          label: string
          landmark: string | null
          name: string | null
          phone: string | null
          pincode: string
          state: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          address_line?: string | null
          address_line_2?: string | null
          address_type?: string
          city: string
          country: string
          created_at?: string | null
          full_name?: string | null
          id?: string
          is_default?: boolean | null
          label: string
          landmark?: string | null
          name?: string | null
          phone?: string | null
          pincode: string
          state?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          address_line?: string | null
          address_line_2?: string | null
          address_type?: string
          city?: string
          country?: string
          created_at?: string | null
          full_name?: string | null
          id?: string
          is_default?: boolean | null
          label?: string
          landmark?: string | null
          name?: string | null
          phone?: string | null
          pincode?: string
          state?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      delivery_profiles: {
        Row: {
          created_at: string
          delivery_metadata: Json
          fixed_fee: number | null
          free_shipping_threshold: number | null
          id: string
          is_active: boolean
          is_default: boolean
          processing_time_max: number
          processing_time_min: number
          profile_name: string
          shipping_rate_type: string | null
          shipping_zones: Json
          shop_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          delivery_metadata?: Json
          fixed_fee?: number | null
          free_shipping_threshold?: number | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          processing_time_max?: number
          processing_time_min?: number
          profile_name: string
          shipping_rate_type?: string | null
          shipping_zones?: Json
          shop_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          delivery_metadata?: Json
          fixed_fee?: number | null
          free_shipping_threshold?: number | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          processing_time_max?: number
          processing_time_min?: number
          profile_name?: string
          shipping_rate_type?: string | null
          shipping_zones?: Json
          shop_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_profiles_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "active_listings_view"
            referencedColumns: ["shop_id"]
          },
          {
            foreignKeyName: "delivery_profiles_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "payment_analytics"
            referencedColumns: ["shop_id"]
          },
          {
            foreignKeyName: "delivery_profiles_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shop_listings_summary"
            referencedColumns: ["shop_id"]
          },
          {
            foreignKeyName: "delivery_profiles_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      discount_assignments: {
        Row: {
          assignment_code: string | null
          created_at: string
          created_by: string | null
          discount_profile_id: string
          expires_at: string | null
          id: string
          notified_at: string | null
          user_id: string
        }
        Insert: {
          assignment_code?: string | null
          created_at?: string
          created_by?: string | null
          discount_profile_id: string
          expires_at?: string | null
          id?: string
          notified_at?: string | null
          user_id: string
        }
        Update: {
          assignment_code?: string | null
          created_at?: string
          created_by?: string | null
          discount_profile_id?: string
          expires_at?: string | null
          id?: string
          notified_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "discount_assignments_discount_profile_id_fkey"
            columns: ["discount_profile_id"]
            isOneToOne: false
            referencedRelation: "discount_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      discount_profiles: {
        Row: {
          applies_to: string
          created_at: string
          description: string | null
          discount_code: string | null
          discount_currency: string
          discount_name: string
          discount_poster: Json | null
          discount_type: string
          discount_value: number
          eligible_categories: string[] | null
          eligible_listings: string[] | null
          eligible_user_types: string[] | null
          event_offer_id: string | null
          id: string
          is_active: boolean
          max_discount_amount: number | null
          max_uses_per_customer: number | null
          max_uses_total: number | null
          min_order_amount: number | null
          shop_id: string | null
          source: string | null
          total_uses: number | null
          updated_at: string
          valid_from: string
          valid_until: string | null
        }
        Insert: {
          applies_to: string
          created_at?: string
          description?: string | null
          discount_code?: string | null
          discount_currency?: string
          discount_name: string
          discount_poster?: Json | null
          discount_type: string
          discount_value: number
          eligible_categories?: string[] | null
          eligible_listings?: string[] | null
          eligible_user_types?: string[] | null
          event_offer_id?: string | null
          id?: string
          is_active?: boolean
          max_discount_amount?: number | null
          max_uses_per_customer?: number | null
          max_uses_total?: number | null
          min_order_amount?: number | null
          shop_id?: string | null
          source?: string | null
          total_uses?: number | null
          updated_at?: string
          valid_from?: string
          valid_until?: string | null
        }
        Update: {
          applies_to?: string
          created_at?: string
          description?: string | null
          discount_code?: string | null
          discount_currency?: string
          discount_name?: string
          discount_poster?: Json | null
          discount_type?: string
          discount_value?: number
          eligible_categories?: string[] | null
          eligible_listings?: string[] | null
          eligible_user_types?: string[] | null
          event_offer_id?: string | null
          id?: string
          is_active?: boolean
          max_discount_amount?: number | null
          max_uses_per_customer?: number | null
          max_uses_total?: number | null
          min_order_amount?: number | null
          shop_id?: string | null
          source?: string | null
          total_uses?: number | null
          updated_at?: string
          valid_from?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "discount_profiles_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "active_listings_view"
            referencedColumns: ["shop_id"]
          },
          {
            foreignKeyName: "discount_profiles_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "payment_analytics"
            referencedColumns: ["shop_id"]
          },
          {
            foreignKeyName: "discount_profiles_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shop_listings_summary"
            referencedColumns: ["shop_id"]
          },
          {
            foreignKeyName: "discount_profiles_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_discount_profiles_event_offer"
            columns: ["event_offer_id"]
            isOneToOne: false
            referencedRelation: "event_offers"
            referencedColumns: ["id"]
          },
        ]
      }
      education: {
        Row: {
          activities: string | null
          created_at: string | null
          degree: string | null
          description: string | null
          end_year: number | null
          field_of_study: string | null
          grade: string | null
          id: string
          location: string | null
          school: string
          school_logo_url: string | null
          skills: string | null
          start_year: number | null
          user_id: string | null
        }
        Insert: {
          activities?: string | null
          created_at?: string | null
          degree?: string | null
          description?: string | null
          end_year?: number | null
          field_of_study?: string | null
          grade?: string | null
          id?: string
          location?: string | null
          school: string
          school_logo_url?: string | null
          skills?: string | null
          start_year?: number | null
          user_id?: string | null
        }
        Update: {
          activities?: string | null
          created_at?: string | null
          degree?: string | null
          description?: string | null
          end_year?: number | null
          field_of_study?: string | null
          grade?: string | null
          id?: string
          location?: string | null
          school?: string
          school_logo_url?: string | null
          skills?: string | null
          start_year?: number | null
          user_id?: string | null
        }
        Relationships: []
      }
      email_otp: {
        Row: {
          attempts: number
          created_at: string
          email: string
          expires_at: string
          id: string
          otp_code: string
          user_id: string | null
          verified: boolean
        }
        Insert: {
          attempts?: number
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          otp_code: string
          user_id?: string | null
          verified?: boolean
        }
        Update: {
          attempts?: number
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          otp_code?: string
          user_id?: string | null
          verified?: boolean
        }
        Relationships: []
      }
      event_offer_categories: {
        Row: {
          category_id: string
          id: string
          offer_id: string
        }
        Insert: {
          category_id: string
          id?: string
          offer_id: string
        }
        Update: {
          category_id?: string
          id?: string
          offer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_offer_categories_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "event_offers"
            referencedColumns: ["id"]
          },
        ]
      }
      event_offer_listings: {
        Row: {
          id: string
          listing_id: string
          offer_id: string
        }
        Insert: {
          id?: string
          listing_id: string
          offer_id: string
        }
        Update: {
          id?: string
          listing_id?: string
          offer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_offer_listings_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "event_offers"
            referencedColumns: ["id"]
          },
        ]
      }
      event_offers: {
        Row: {
          applies_to: string
          created_at: string
          currency: string
          discount_type: string
          discount_value: number
          event_id: string
          id: string
          max_discount_amount: number | null
          max_uses_per_customer: number | null
          max_uses_total: number | null
          min_order_amount: number | null
          offer_name: string
        }
        Insert: {
          applies_to?: string
          created_at?: string
          currency?: string
          discount_type: string
          discount_value: number
          event_id: string
          id?: string
          max_discount_amount?: number | null
          max_uses_per_customer?: number | null
          max_uses_total?: number | null
          min_order_amount?: number | null
          offer_name: string
        }
        Update: {
          applies_to?: string
          created_at?: string
          currency?: string
          discount_type?: string
          discount_value?: number
          event_id?: string
          id?: string
          max_discount_amount?: number | null
          max_uses_per_customer?: number | null
          max_uses_total?: number | null
          min_order_amount?: number | null
          offer_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_offers_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "sale_events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_registrations: {
        Row: {
          event_id: string
          id: string
          notes: string | null
          post_id: string | null
          registration_date: string | null
          status: string | null
          user_id: string
        }
        Insert: {
          event_id: string
          id?: string
          notes?: string | null
          post_id?: string | null
          registration_date?: string | null
          status?: string | null
          user_id: string
        }
        Update: {
          event_id?: string
          id?: string
          notes?: string | null
          post_id?: string | null
          registration_date?: string | null
          status?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_registrations_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_registrations_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_registrations_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts_with_stats"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          created_at: string | null
          currency: string | null
          description: string | null
          end_time: string | null
          event_type: string | null
          id: string
          image_url: string | null
          is_free: boolean | null
          is_online: boolean | null
          location: string | null
          max_attendees: number | null
          meeting_url: string | null
          organizer_id: string
          post_id: string | null
          price: number | null
          registration_required: boolean | null
          start_time: string
          status: string | null
          tags: string[] | null
          title: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          currency?: string | null
          description?: string | null
          end_time?: string | null
          event_type?: string | null
          id?: string
          image_url?: string | null
          is_free?: boolean | null
          is_online?: boolean | null
          location?: string | null
          max_attendees?: number | null
          meeting_url?: string | null
          organizer_id: string
          post_id?: string | null
          price?: number | null
          registration_required?: boolean | null
          start_time: string
          status?: string | null
          tags?: string[] | null
          title: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          currency?: string | null
          description?: string | null
          end_time?: string | null
          event_type?: string | null
          id?: string
          image_url?: string | null
          is_free?: boolean | null
          is_online?: boolean | null
          location?: string | null
          max_attendees?: number | null
          meeting_url?: string | null
          organizer_id?: string
          post_id?: string | null
          price?: number | null
          registration_required?: boolean | null
          start_time?: string
          status?: string | null
          tags?: string[] | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "events_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts_with_stats"
            referencedColumns: ["id"]
          },
        ]
      }
      exchange_rate_cache: {
        Row: {
          base: string
          fetched_at: string
          last_update_at: string | null
          next_update_at: string | null
          rates: Json
        }
        Insert: {
          base: string
          fetched_at?: string
          last_update_at?: string | null
          next_update_at?: string | null
          rates: Json
        }
        Update: {
          base?: string
          fetched_at?: string
          last_update_at?: string | null
          next_update_at?: string | null
          rates?: Json
        }
        Relationships: []
      }
      experiences: {
        Row: {
          company_name: string | null
          created_at: string
          description: string | null
          employment_type: string | null
          end_date: string | null
          id: string
          industry: string | null
          is_current: boolean | null
          location: string | null
          location_type: string | null
          skills: string | null
          start_date: string | null
          title: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          company_name?: string | null
          created_at?: string
          description?: string | null
          employment_type?: string | null
          end_date?: string | null
          id?: string
          industry?: string | null
          is_current?: boolean | null
          location?: string | null
          location_type?: string | null
          skills?: string | null
          start_date?: string | null
          title?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          company_name?: string | null
          created_at?: string
          description?: string | null
          employment_type?: string | null
          end_date?: string | null
          id?: string
          industry?: string | null
          is_current?: boolean | null
          location?: string | null
          location_type?: string | null
          skills?: string | null
          start_date?: string | null
          title?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      feed_preferences: {
        Row: {
          created_at: string | null
          feed_algorithm: string | null
          hidden_posts: string[] | null
          id: string
          muted_users: string[] | null
          preferred_topics: string[] | null
          show_liked_posts: boolean | null
          show_reposts: boolean | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          feed_algorithm?: string | null
          hidden_posts?: string[] | null
          id?: string
          muted_users?: string[] | null
          preferred_topics?: string[] | null
          show_liked_posts?: boolean | null
          show_reposts?: boolean | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          feed_algorithm?: string | null
          hidden_posts?: string[] | null
          id?: string
          muted_users?: string[] | null
          preferred_topics?: string[] | null
          show_liked_posts?: boolean | null
          show_reposts?: boolean | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      follows: {
        Row: {
          created_at: string | null
          follower_id: string
          following_id: string
          id: string
          meta_data: Json | null
          status: string | null
        }
        Insert: {
          created_at?: string | null
          follower_id: string
          following_id: string
          id?: string
          meta_data?: Json | null
          status?: string | null
        }
        Update: {
          created_at?: string | null
          follower_id?: string
          following_id?: string
          id?: string
          meta_data?: Json | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "follows_follower_id_profiles_fkey"
            columns: ["follower_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follows_following_id_fkey"
            columns: ["following_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follows_following_id_profiles_fkey"
            columns: ["following_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      fulfillment_events: {
        Row: {
          created_at: string
          event_code: string | null
          event_data: Json
          event_description: string
          event_location: string | null
          event_timestamp: string
          event_type: string
          fulfillment_id: string
          id: string
          latitude: number | null
          longitude: number | null
          new_status:
            | Database["public"]["Enums"]["fulfillment_status_enum"]
            | null
          previous_status:
            | Database["public"]["Enums"]["fulfillment_status_enum"]
            | null
          source_system: string | null
          timezone: string | null
          triggered_by: string | null
        }
        Insert: {
          created_at?: string
          event_code?: string | null
          event_data?: Json
          event_description: string
          event_location?: string | null
          event_timestamp: string
          event_type: string
          fulfillment_id: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          new_status?:
            | Database["public"]["Enums"]["fulfillment_status_enum"]
            | null
          previous_status?:
            | Database["public"]["Enums"]["fulfillment_status_enum"]
            | null
          source_system?: string | null
          timezone?: string | null
          triggered_by?: string | null
        }
        Update: {
          created_at?: string
          event_code?: string | null
          event_data?: Json
          event_description?: string
          event_location?: string | null
          event_timestamp?: string
          event_type?: string
          fulfillment_id?: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          new_status?:
            | Database["public"]["Enums"]["fulfillment_status_enum"]
            | null
          previous_status?:
            | Database["public"]["Enums"]["fulfillment_status_enum"]
            | null
          source_system?: string | null
          timezone?: string | null
          triggered_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fulfillment_events_fulfillment_id_fkey"
            columns: ["fulfillment_id"]
            isOneToOne: false
            referencedRelation: "order_fulfillments"
            referencedColumns: ["id"]
          },
        ]
      }
      function_change_log: {
        Row: {
          change_type: string
          changed_at: string | null
          changed_by: string | null
          function_definition: string | null
          function_name: string
          function_signature: string | null
          id: string
          source_info: Json | null
        }
        Insert: {
          change_type: string
          changed_at?: string | null
          changed_by?: string | null
          function_definition?: string | null
          function_name: string
          function_signature?: string | null
          id?: string
          source_info?: Json | null
        }
        Update: {
          change_type?: string
          changed_at?: string | null
          changed_by?: string | null
          function_definition?: string | null
          function_name?: string
          function_signature?: string | null
          id?: string
          source_info?: Json | null
        }
        Relationships: []
      }
      gender_verification_sessions: {
        Row: {
          challenge_types: string[]
          client_metrics: Json | null
          created_at: string
          detected_blinks: number
          expires_at: string
          failure_reason: string | null
          gender_confidence: number | null
          gender_detected: boolean | null
          id: string
          liveness_score: number | null
          required_blinks: number
          status: string
          user_id: string
          verified_at: string | null
        }
        Insert: {
          challenge_types?: string[]
          client_metrics?: Json | null
          created_at?: string
          detected_blinks?: number
          expires_at: string
          failure_reason?: string | null
          gender_confidence?: number | null
          gender_detected?: boolean | null
          id?: string
          liveness_score?: number | null
          required_blinks?: number
          status?: string
          user_id: string
          verified_at?: string | null
        }
        Update: {
          challenge_types?: string[]
          client_metrics?: Json | null
          created_at?: string
          detected_blinks?: number
          expires_at?: string
          failure_reason?: string | null
          gender_confidence?: number | null
          gender_detected?: boolean | null
          id?: string
          liveness_score?: number | null
          required_blinks?: number
          status?: string
          user_id?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gender_verification_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      group_invitations: {
        Row: {
          created_at: string | null
          group_id: string | null
          id: string
          invited_by: string | null
          invited_user_id: string | null
          message: string | null
          responded_at: string | null
          status: string | null
        }
        Insert: {
          created_at?: string | null
          group_id?: string | null
          id?: string
          invited_by?: string | null
          invited_user_id?: string | null
          message?: string | null
          responded_at?: string | null
          status?: string | null
        }
        Update: {
          created_at?: string | null
          group_id?: string | null
          id?: string
          invited_by?: string | null
          invited_user_id?: string | null
          message?: string | null
          responded_at?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "group_invitations_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_invitations_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_invitations_invited_user_id_fkey"
            columns: ["invited_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      group_join_requests: {
        Row: {
          group_id: string | null
          id: string
          requested_at: string | null
          status: string | null
          user_id: string | null
        }
        Insert: {
          group_id?: string | null
          id?: string
          requested_at?: string | null
          status?: string | null
          user_id?: string | null
        }
        Update: {
          group_id?: string | null
          id?: string
          requested_at?: string | null
          status?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "group_join_requests_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      group_members: {
        Row: {
          group_id: string | null
          id: string
          joined_at: string | null
          role: string | null
          status: string | null
          user_id: string | null
        }
        Insert: {
          group_id?: string | null
          id?: string
          joined_at?: string | null
          role?: string | null
          status?: string | null
          user_id?: string | null
        }
        Update: {
          group_id?: string | null
          id?: string
          joined_at?: string | null
          role?: string | null
          status?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      groups: {
        Row: {
          allow_invites: boolean | null
          avatar_url: string | null
          cover_url: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          group_type: string | null
          id: string
          industries: string[] | null
          location: string | null
          members_count: number | null
          name: string
          raw_group_data: Json | null
          require_post_review: boolean | null
          rules: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          allow_invites?: boolean | null
          avatar_url?: string | null
          cover_url?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          group_type?: string | null
          id?: string
          industries?: string[] | null
          location?: string | null
          members_count?: number | null
          name: string
          raw_group_data?: Json | null
          require_post_review?: boolean | null
          rules?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          allow_invites?: boolean | null
          avatar_url?: string | null
          cover_url?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          group_type?: string | null
          id?: string
          industries?: string[] | null
          location?: string | null
          members_count?: number | null
          name?: string
          raw_group_data?: Json | null
          require_post_review?: boolean | null
          rules?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "groups_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      hashtag_follows: {
        Row: {
          created_at: string | null
          hashtag: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          hashtag: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          hashtag?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      hashtags: {
        Row: {
          created_at: string | null
          hashtag: string
          id: string
          trending_score: number | null
          updated_at: string | null
          usage_count: number | null
        }
        Insert: {
          created_at?: string | null
          hashtag: string
          id?: string
          trending_score?: number | null
          updated_at?: string | null
          usage_count?: number | null
        }
        Update: {
          created_at?: string | null
          hashtag?: string
          id?: string
          trending_score?: number | null
          updated_at?: string | null
          usage_count?: number | null
        }
        Relationships: []
      }
      introduction_requests: {
        Row: {
          created_at: string
          id: string
          introducer_id: string
          message: string | null
          requester_id: string
          status: string
          target_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          introducer_id: string
          message?: string | null
          requester_id: string
          status?: string
          target_id: string
        }
        Update: {
          created_at?: string
          id?: string
          introducer_id?: string
          message?: string | null
          requester_id?: string
          status?: string
          target_id?: string
        }
        Relationships: []
      }
      inventory_reservations: {
        Row: {
          checkout_group_id: string
          converted_at: string | null
          created_at: string
          expires_at: string
          id: string
          listing_id: string
          quantity: number
          released_at: string | null
          status: string
          variation_id: string | null
        }
        Insert: {
          checkout_group_id: string
          converted_at?: string | null
          created_at?: string
          expires_at: string
          id?: string
          listing_id: string
          quantity: number
          released_at?: string | null
          status?: string
          variation_id?: string | null
        }
        Update: {
          checkout_group_id?: string
          converted_at?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          listing_id?: string
          quantity?: number
          released_at?: string | null
          status?: string
          variation_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_reservations_checkout_group_id_fkey"
            columns: ["checkout_group_id"]
            isOneToOne: false
            referencedRelation: "commerce_checkout_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_reservations_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "active_listings_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_reservations_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "active_listings_with_shop"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_reservations_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listing_details_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_reservations_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_reservations_variation_id_fkey"
            columns: ["variation_id"]
            isOneToOne: false
            referencedRelation: "listing_variations"
            referencedColumns: ["id"]
          },
        ]
      }
      job_applications: {
        Row: {
          cover_letter: string | null
          created_at: string | null
          id: string
          job_id: string
          notes: string | null
          resume_url: string | null
          status: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          cover_letter?: string | null
          created_at?: string | null
          id?: string
          job_id: string
          notes?: string | null
          resume_url?: string | null
          status?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          cover_letter?: string | null
          created_at?: string | null
          id?: string
          job_id?: string
          notes?: string | null
          resume_url?: string | null
          status?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_applications_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      job_views: {
        Row: {
          created_at: string | null
          id: string
          ip_address: unknown
          job_id: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          ip_address?: unknown
          job_id: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          ip_address?: unknown
          job_id?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "job_views_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs: {
        Row: {
          applicants_count: number | null
          benefits: string | null
          company_logo: string | null
          company_name: string
          created_at: string | null
          description: string
          experience_level: string
          expires_at: string | null
          id: string
          industry: string | null
          is_active: boolean | null
          is_easy_apply: boolean | null
          is_promoted: boolean | null
          is_remote: boolean | null
          job_type: string
          location: string
          posted_by: string
          requirements: string | null
          salary_range: string | null
          status: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          applicants_count?: number | null
          benefits?: string | null
          company_logo?: string | null
          company_name: string
          created_at?: string | null
          description: string
          experience_level?: string
          expires_at?: string | null
          id?: string
          industry?: string | null
          is_active?: boolean | null
          is_easy_apply?: boolean | null
          is_promoted?: boolean | null
          is_remote?: boolean | null
          job_type?: string
          location: string
          posted_by: string
          requirements?: string | null
          salary_range?: string | null
          status?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          applicants_count?: number | null
          benefits?: string | null
          company_logo?: string | null
          company_name?: string
          created_at?: string | null
          description?: string
          experience_level?: string
          expires_at?: string | null
          id?: string
          industry?: string | null
          is_active?: boolean | null
          is_easy_apply?: boolean | null
          is_promoted?: boolean | null
          is_remote?: boolean | null
          job_type?: string
          location?: string
          posted_by?: string
          requirements?: string | null
          salary_range?: string | null
          status?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      kv_store_934ec7df: {
        Row: {
          key: string
          value: Json
        }
        Insert: {
          key: string
          value: Json
        }
        Update: {
          key?: string
          value?: Json
        }
        Relationships: []
      }
      languages: {
        Row: {
          created_at: string
          id: string
          language_name: string
          proficiency: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          language_name: string
          proficiency?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          language_name?: string
          proficiency?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      listing_attributes: {
        Row: {
          attribute_name: string
          attribute_type: string | null
          attribute_value: string
          created_at: string
          display_order: number
          id: string
          is_filterable: boolean
          listing_id: string
          updated_at: string
        }
        Insert: {
          attribute_name: string
          attribute_type?: string | null
          attribute_value: string
          created_at?: string
          display_order?: number
          id?: string
          is_filterable?: boolean
          listing_id: string
          updated_at?: string
        }
        Update: {
          attribute_name?: string
          attribute_type?: string | null
          attribute_value?: string
          created_at?: string
          display_order?: number
          id?: string
          is_filterable?: boolean
          listing_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "listing_attributes_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "active_listings_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_attributes_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "active_listings_with_shop"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_attributes_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listing_details_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_attributes_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      listing_bundle_items: {
        Row: {
          bundle_id: string
          created_at: string
          display_order: number
          id: string
          listing_id: string
          quantity: number
        }
        Insert: {
          bundle_id: string
          created_at?: string
          display_order?: number
          id?: string
          listing_id: string
          quantity?: number
        }
        Update: {
          bundle_id?: string
          created_at?: string
          display_order?: number
          id?: string
          listing_id?: string
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "listing_bundle_items_bundle_id_fkey"
            columns: ["bundle_id"]
            isOneToOne: false
            referencedRelation: "listing_bundles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_bundle_items_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "active_listings_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_bundle_items_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "active_listings_with_shop"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_bundle_items_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listing_details_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_bundle_items_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      listing_bundles: {
        Row: {
          bundle_price: number
          created_at: string
          currency: string
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean
          shop_id: string
          slug: string | null
          title: string
          updated_at: string
        }
        Insert: {
          bundle_price: number
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          shop_id: string
          slug?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          bundle_price?: number
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          shop_id?: string
          slug?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "listing_bundles_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "active_listings_view"
            referencedColumns: ["shop_id"]
          },
          {
            foreignKeyName: "listing_bundles_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "payment_analytics"
            referencedColumns: ["shop_id"]
          },
          {
            foreignKeyName: "listing_bundles_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shop_listings_summary"
            referencedColumns: ["shop_id"]
          },
          {
            foreignKeyName: "listing_bundles_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      listing_delivery_profiles: {
        Row: {
          created_at: string
          delivery_profile_id: string
          id: string
          listing_id: string
        }
        Insert: {
          created_at?: string
          delivery_profile_id: string
          id?: string
          listing_id: string
        }
        Update: {
          created_at?: string
          delivery_profile_id?: string
          id?: string
          listing_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "listing_delivery_profiles_delivery_profile_id_fkey"
            columns: ["delivery_profile_id"]
            isOneToOne: false
            referencedRelation: "delivery_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_delivery_profiles_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "active_listings_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_delivery_profiles_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "active_listings_with_shop"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_delivery_profiles_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listing_details_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_delivery_profiles_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      listing_demand_forecasts: {
        Row: {
          average_daily_sales: number
          computed_at: string
          forecast_units_14d: number
          forecast_units_30d: number
          forecast_units_90d: number
          listing_id: string
          on_hand: number
          reorder_point: number | null
          shop_id: string
          stock_cover_days: number | null
          suggested_restock_qty: number
          units_28d: number
          units_7d: number
          units_90d: number
        }
        Insert: {
          average_daily_sales?: number
          computed_at?: string
          forecast_units_14d?: number
          forecast_units_30d?: number
          forecast_units_90d?: number
          listing_id: string
          on_hand?: number
          reorder_point?: number | null
          shop_id: string
          stock_cover_days?: number | null
          suggested_restock_qty?: number
          units_28d?: number
          units_7d?: number
          units_90d?: number
        }
        Update: {
          average_daily_sales?: number
          computed_at?: string
          forecast_units_14d?: number
          forecast_units_30d?: number
          forecast_units_90d?: number
          listing_id?: string
          on_hand?: number
          reorder_point?: number | null
          shop_id?: string
          stock_cover_days?: number | null
          suggested_restock_qty?: number
          units_28d?: number
          units_7d?: number
          units_90d?: number
        }
        Relationships: [
          {
            foreignKeyName: "listing_demand_forecasts_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: true
            referencedRelation: "active_listings_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_demand_forecasts_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: true
            referencedRelation: "active_listings_with_shop"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_demand_forecasts_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: true
            referencedRelation: "listing_details_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_demand_forecasts_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: true
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_demand_forecasts_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "active_listings_view"
            referencedColumns: ["shop_id"]
          },
          {
            foreignKeyName: "listing_demand_forecasts_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "payment_analytics"
            referencedColumns: ["shop_id"]
          },
          {
            foreignKeyName: "listing_demand_forecasts_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shop_listings_summary"
            referencedColumns: ["shop_id"]
          },
          {
            foreignKeyName: "listing_demand_forecasts_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      listing_discounts: {
        Row: {
          created_at: string
          discount_profile_id: string
          id: string
          listing_id: string
        }
        Insert: {
          created_at?: string
          discount_profile_id: string
          id?: string
          listing_id: string
        }
        Update: {
          created_at?: string
          discount_profile_id?: string
          id?: string
          listing_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "listing_discounts_discount_profile_id_fkey"
            columns: ["discount_profile_id"]
            isOneToOne: false
            referencedRelation: "discount_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_discounts_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "active_listings_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_discounts_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "active_listings_with_shop"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_discounts_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listing_details_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_discounts_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      listing_images: {
        Row: {
          alt_text: string | null
          created_at: string
          display_order: number
          file_size: number | null
          height: number | null
          id: string
          image_metadata: Json | null
          image_type: string | null
          image_url: string
          is_primary: boolean
          listing_id: string
          updated_at: string
          width: number | null
        }
        Insert: {
          alt_text?: string | null
          created_at?: string
          display_order?: number
          file_size?: number | null
          height?: number | null
          id?: string
          image_metadata?: Json | null
          image_type?: string | null
          image_url: string
          is_primary?: boolean
          listing_id: string
          updated_at?: string
          width?: number | null
        }
        Update: {
          alt_text?: string | null
          created_at?: string
          display_order?: number
          file_size?: number | null
          height?: number | null
          id?: string
          image_metadata?: Json | null
          image_type?: string | null
          image_url?: string
          is_primary?: boolean
          listing_id?: string
          updated_at?: string
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "listing_images_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "active_listings_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_images_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "active_listings_with_shop"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_images_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listing_details_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_images_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      listing_inquiries: {
        Row: {
          buyer_id: string
          closed_at: string | null
          created_at: string
          id: string
          listing_id: string
          message: string
          replied_at: string | null
          seller_id: string
          seller_reply: string | null
          shop_id: string
          status: string
          updated_at: string
        }
        Insert: {
          buyer_id: string
          closed_at?: string | null
          created_at?: string
          id?: string
          listing_id: string
          message: string
          replied_at?: string | null
          seller_id: string
          seller_reply?: string | null
          shop_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          buyer_id?: string
          closed_at?: string | null
          created_at?: string
          id?: string
          listing_id?: string
          message?: string
          replied_at?: string | null
          seller_id?: string
          seller_reply?: string | null
          shop_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "listing_inquiries_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "active_listings_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_inquiries_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "active_listings_with_shop"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_inquiries_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listing_details_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_inquiries_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_inquiries_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "active_listings_view"
            referencedColumns: ["shop_id"]
          },
          {
            foreignKeyName: "listing_inquiries_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "payment_analytics"
            referencedColumns: ["shop_id"]
          },
          {
            foreignKeyName: "listing_inquiries_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shop_listings_summary"
            referencedColumns: ["shop_id"]
          },
          {
            foreignKeyName: "listing_inquiries_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      listing_materials: {
        Row: {
          certification: string | null
          created_at: string
          id: string
          is_primary: boolean
          is_sustainable: boolean
          listing_id: string
          material_name: string
          percentage: number | null
        }
        Insert: {
          certification?: string | null
          created_at?: string
          id?: string
          is_primary?: boolean
          is_sustainable?: boolean
          listing_id: string
          material_name: string
          percentage?: number | null
        }
        Update: {
          certification?: string | null
          created_at?: string
          id?: string
          is_primary?: boolean
          is_sustainable?: boolean
          listing_id?: string
          material_name?: string
          percentage?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "listing_materials_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "active_listings_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_materials_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "active_listings_with_shop"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_materials_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listing_details_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_materials_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      listing_recently_viewed: {
        Row: {
          listing_id: string
          user_id: string
          viewed_at: string
        }
        Insert: {
          listing_id: string
          user_id: string
          viewed_at?: string
        }
        Update: {
          listing_id?: string
          user_id?: string
          viewed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "listing_recently_viewed_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "active_listings_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_recently_viewed_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "active_listings_with_shop"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_recently_viewed_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listing_details_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_recently_viewed_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      listing_reorder_schedules: {
        Row: {
          address_id: string | null
          cadence: string
          created_at: string
          id: string
          last_notified_at: string | null
          listing_id: string
          next_run_at: string
          paused: boolean
          quantity: number
          updated_at: string
          user_id: string
          variant_id: string | null
        }
        Insert: {
          address_id?: string | null
          cadence: string
          created_at?: string
          id?: string
          last_notified_at?: string | null
          listing_id: string
          next_run_at: string
          paused?: boolean
          quantity?: number
          updated_at?: string
          user_id: string
          variant_id?: string | null
        }
        Update: {
          address_id?: string | null
          cadence?: string
          created_at?: string
          id?: string
          last_notified_at?: string | null
          listing_id?: string
          next_run_at?: string
          paused?: boolean
          quantity?: number
          updated_at?: string
          user_id?: string
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "listing_reorder_schedules_address_id_fkey"
            columns: ["address_id"]
            isOneToOne: false
            referencedRelation: "addresses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_reorder_schedules_address_id_fkey"
            columns: ["address_id"]
            isOneToOne: false
            referencedRelation: "shop_addresses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_reorder_schedules_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "active_listings_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_reorder_schedules_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "active_listings_with_shop"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_reorder_schedules_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listing_details_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_reorder_schedules_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_reorder_schedules_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "listing_variations"
            referencedColumns: ["id"]
          },
        ]
      }
      listing_return_policies: {
        Row: {
          created_at: string
          listing_id: string
          return_policy_id: string
        }
        Insert: {
          created_at?: string
          listing_id: string
          return_policy_id: string
        }
        Update: {
          created_at?: string
          listing_id?: string
          return_policy_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "listing_return_policies_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "active_listings_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_return_policies_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "active_listings_with_shop"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_return_policies_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listing_details_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_return_policies_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_return_policies_return_policy_id_fkey"
            columns: ["return_policy_id"]
            isOneToOne: false
            referencedRelation: "return_policies"
            referencedColumns: ["id"]
          },
        ]
      }
      listing_review_analytics: {
        Row: {
          analytics_metadata: Json
          approved_reviews: number
          average_rating: number
          avg_quality_rating: number | null
          avg_reply_time_hours: number | null
          avg_service_rating: number | null
          avg_shipping_rating: number | null
          avg_value_rating: number | null
          created_at: string
          flagged_reviews: number
          id: string
          listing_id: string
          new_reviews: number
          pending_reviews: number
          period_end: string
          period_start: string
          period_type: string
          rating_distribution: Json
          rating_trend: number | null
          rejected_reviews: number
          review_velocity: number | null
          sentiment_distribution: Json
          shop_id: string
          total_helpfulness_votes: number
          total_replies: number
          total_reviews: number
          updated_at: string
          verified_purchase_percentage: number | null
        }
        Insert: {
          analytics_metadata?: Json
          approved_reviews?: number
          average_rating?: number
          avg_quality_rating?: number | null
          avg_reply_time_hours?: number | null
          avg_service_rating?: number | null
          avg_shipping_rating?: number | null
          avg_value_rating?: number | null
          created_at?: string
          flagged_reviews?: number
          id?: string
          listing_id: string
          new_reviews?: number
          pending_reviews?: number
          period_end: string
          period_start: string
          period_type: string
          rating_distribution?: Json
          rating_trend?: number | null
          rejected_reviews?: number
          review_velocity?: number | null
          sentiment_distribution?: Json
          shop_id: string
          total_helpfulness_votes?: number
          total_replies?: number
          total_reviews?: number
          updated_at?: string
          verified_purchase_percentage?: number | null
        }
        Update: {
          analytics_metadata?: Json
          approved_reviews?: number
          average_rating?: number
          avg_quality_rating?: number | null
          avg_reply_time_hours?: number | null
          avg_service_rating?: number | null
          avg_shipping_rating?: number | null
          avg_value_rating?: number | null
          created_at?: string
          flagged_reviews?: number
          id?: string
          listing_id?: string
          new_reviews?: number
          pending_reviews?: number
          period_end?: string
          period_start?: string
          period_type?: string
          rating_distribution?: Json
          rating_trend?: number | null
          rejected_reviews?: number
          review_velocity?: number | null
          sentiment_distribution?: Json
          shop_id?: string
          total_helpfulness_votes?: number
          total_replies?: number
          total_reviews?: number
          updated_at?: string
          verified_purchase_percentage?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "listing_review_analytics_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "active_listings_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_review_analytics_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "active_listings_with_shop"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_review_analytics_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listing_details_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_review_analytics_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_review_analytics_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "active_listings_view"
            referencedColumns: ["shop_id"]
          },
          {
            foreignKeyName: "listing_review_analytics_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "payment_analytics"
            referencedColumns: ["shop_id"]
          },
          {
            foreignKeyName: "listing_review_analytics_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shop_listings_summary"
            referencedColumns: ["shop_id"]
          },
          {
            foreignKeyName: "listing_review_analytics_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      listing_review_helpfulness: {
        Row: {
          created_at: string
          id: string
          is_helpful: boolean
          review_id: string
          updated_at: string
          user_id: string
          vote_metadata: Json
        }
        Insert: {
          created_at?: string
          id?: string
          is_helpful: boolean
          review_id: string
          updated_at?: string
          user_id: string
          vote_metadata?: Json
        }
        Update: {
          created_at?: string
          id?: string
          is_helpful?: boolean
          review_id?: string
          updated_at?: string
          user_id?: string
          vote_metadata?: Json
        }
        Relationships: [
          {
            foreignKeyName: "listing_review_helpfulness_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "listing_reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      listing_review_replies: {
        Row: {
          created_at: string
          id: string
          is_pinned: boolean
          is_public: boolean
          is_vendor_reply: boolean
          parent_reply_id: string | null
          replier_id: string
          reply_text: string
          review_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_pinned?: boolean
          is_public?: boolean
          is_vendor_reply?: boolean
          parent_reply_id?: string | null
          replier_id: string
          reply_text: string
          review_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_pinned?: boolean
          is_public?: boolean
          is_vendor_reply?: boolean
          parent_reply_id?: string | null
          replier_id?: string
          reply_text?: string
          review_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "listing_review_replies_parent_reply_id_fkey"
            columns: ["parent_reply_id"]
            isOneToOne: false
            referencedRelation: "listing_review_replies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_review_replies_parent_reply_id_fkey"
            columns: ["parent_reply_id"]
            isOneToOne: false
            referencedRelation: "listing_review_replies_public_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_review_replies_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "listing_reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      listing_review_reports: {
        Row: {
          created_at: string
          evidence_urls: Json
          id: string
          priority_level: string
          report_description: string | null
          report_metadata: Json
          report_reason: string
          report_status: string
          reporter_id: string
          resolution_action: string | null
          resolution_notes: string | null
          review_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          evidence_urls?: Json
          id?: string
          priority_level?: string
          report_description?: string | null
          report_metadata?: Json
          report_reason: string
          report_status?: string
          reporter_id: string
          resolution_action?: string | null
          resolution_notes?: string | null
          review_id: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          evidence_urls?: Json
          id?: string
          priority_level?: string
          report_description?: string | null
          report_metadata?: Json
          report_reason?: string
          report_status?: string
          reporter_id?: string
          resolution_action?: string | null
          resolution_notes?: string | null
          review_id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "listing_review_reports_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "listing_reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      listing_reviews: {
        Row: {
          analytics_data: Json
          auto_sentiment:
            | Database["public"]["Enums"]["review_sentiment_enum"]
            | null
          created_at: string
          helpful_count: number
          id: string
          is_verified_purchase: boolean
          listing_id: string
          moderated_at: string | null
          moderated_by: string | null
          moderation_reason: string | null
          not_helpful_count: number
          order_id: string | null
          published_at: string | null
          purchase_verified_at: string | null
          quality_rating: number | null
          rating: number
          reply_count: number
          review_images: Json
          review_metadata: Json
          review_status: Database["public"]["Enums"]["listing_review_status_enum"]
          review_text: string
          review_type: Database["public"]["Enums"]["review_type_enum"]
          review_videos: Json
          reviewer_id: string
          service_rating: number | null
          shipping_rating: number | null
          title: string | null
          updated_at: string
          value_rating: number | null
          variation_id: string | null
        }
        Insert: {
          analytics_data?: Json
          auto_sentiment?:
            | Database["public"]["Enums"]["review_sentiment_enum"]
            | null
          created_at?: string
          helpful_count?: number
          id?: string
          is_verified_purchase?: boolean
          listing_id: string
          moderated_at?: string | null
          moderated_by?: string | null
          moderation_reason?: string | null
          not_helpful_count?: number
          order_id?: string | null
          published_at?: string | null
          purchase_verified_at?: string | null
          quality_rating?: number | null
          rating: number
          reply_count?: number
          review_images?: Json
          review_metadata?: Json
          review_status?: Database["public"]["Enums"]["listing_review_status_enum"]
          review_text: string
          review_type?: Database["public"]["Enums"]["review_type_enum"]
          review_videos?: Json
          reviewer_id: string
          service_rating?: number | null
          shipping_rating?: number | null
          title?: string | null
          updated_at?: string
          value_rating?: number | null
          variation_id?: string | null
        }
        Update: {
          analytics_data?: Json
          auto_sentiment?:
            | Database["public"]["Enums"]["review_sentiment_enum"]
            | null
          created_at?: string
          helpful_count?: number
          id?: string
          is_verified_purchase?: boolean
          listing_id?: string
          moderated_at?: string | null
          moderated_by?: string | null
          moderation_reason?: string | null
          not_helpful_count?: number
          order_id?: string | null
          published_at?: string | null
          purchase_verified_at?: string | null
          quality_rating?: number | null
          rating?: number
          reply_count?: number
          review_images?: Json
          review_metadata?: Json
          review_status?: Database["public"]["Enums"]["listing_review_status_enum"]
          review_text?: string
          review_type?: Database["public"]["Enums"]["review_type_enum"]
          review_videos?: Json
          reviewer_id?: string
          service_rating?: number | null
          shipping_rating?: number | null
          title?: string | null
          updated_at?: string
          value_rating?: number | null
          variation_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "listing_reviews_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "active_listings_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_reviews_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "active_listings_with_shop"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_reviews_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listing_details_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_reviews_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_reviews_variation_id_fkey"
            columns: ["variation_id"]
            isOneToOne: false
            referencedRelation: "listing_variations"
            referencedColumns: ["id"]
          },
        ]
      }
      listing_sections: {
        Row: {
          created_at: string
          listing_id: string
          section_id: string
        }
        Insert: {
          created_at?: string
          listing_id: string
          section_id: string
        }
        Update: {
          created_at?: string
          listing_id?: string
          section_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "listing_sections_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "active_listings_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_sections_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "active_listings_with_shop"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_sections_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listing_details_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_sections_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_sections_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "shop_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      listing_stock_alerts: {
        Row: {
          created_at: string
          id: string
          listing_id: string
          notified_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          listing_id: string
          notified_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          listing_id?: string
          notified_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "listing_stock_alerts_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "active_listings_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_stock_alerts_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "active_listings_with_shop"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_stock_alerts_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listing_details_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_stock_alerts_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      listing_tags: {
        Row: {
          created_at: string
          id: string
          listing_id: string
          tag_name: string
        }
        Insert: {
          created_at?: string
          id?: string
          listing_id: string
          tag_name: string
        }
        Update: {
          created_at?: string
          id?: string
          listing_id?: string
          tag_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "listing_tags_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "active_listings_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_tags_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "active_listings_with_shop"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_tags_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listing_details_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_tags_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      listing_variations: {
        Row: {
          created_at: string
          display_order: number
          id: string
          is_available: boolean
          listing_id: string
          price_adjustment: number | null
          sku: string | null
          stock: number | null
          updated_at: string
          variation_metadata: Json
          variation_name: string
          variation_value: string
          weight: number | null
        }
        Insert: {
          created_at?: string
          display_order?: number
          id?: string
          is_available?: boolean
          listing_id: string
          price_adjustment?: number | null
          sku?: string | null
          stock?: number | null
          updated_at?: string
          variation_metadata?: Json
          variation_name: string
          variation_value: string
          weight?: number | null
        }
        Update: {
          created_at?: string
          display_order?: number
          id?: string
          is_available?: boolean
          listing_id?: string
          price_adjustment?: number | null
          sku?: string | null
          stock?: number | null
          updated_at?: string
          variation_metadata?: Json
          variation_name?: string
          variation_value?: string
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "listing_variations_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "active_listings_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_variations_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "active_listings_with_shop"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_variations_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listing_details_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_variations_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      listings: {
        Row: {
          average_rating: number | null
          booking_duration_minutes: number | null
          category: string | null
          created_at: string
          description: string | null
          digital_file_size: number | null
          digital_file_type: string | null
          digital_file_url: string | null
          dimensions: Json | null
          download_limit: number | null
          id: string
          is_active: boolean
          is_featured: boolean
          is_online: boolean | null
          listing_metadata: Json
          listing_status: Database["public"]["Enums"]["listing_status_enum"]
          listing_type: Database["public"]["Enums"]["listing_type_enum"]
          location_id: string | null
          max_attendees: number | null
          meeting_url: string | null
          meta_description: string | null
          meta_title: string | null
          mrp: number | null
          price: number
          price_includes_tax: boolean
          product_info: Json
          published_at: string | null
          quantity: number | null
          requires_approval: boolean | null
          search_vector: unknown
          shipping_required: boolean | null
          shop_id: string
          sku: string | null
          slug: string | null
          stock: number | null
          tags: string[] | null
          tax_percent: number | null
          title: string
          total_reviews: number | null
          updated_at: string
          weight: number | null
        }
        Insert: {
          average_rating?: number | null
          booking_duration_minutes?: number | null
          category?: string | null
          created_at?: string
          description?: string | null
          digital_file_size?: number | null
          digital_file_type?: string | null
          digital_file_url?: string | null
          dimensions?: Json | null
          download_limit?: number | null
          id?: string
          is_active?: boolean
          is_featured?: boolean
          is_online?: boolean | null
          listing_metadata?: Json
          listing_status?: Database["public"]["Enums"]["listing_status_enum"]
          listing_type: Database["public"]["Enums"]["listing_type_enum"]
          location_id?: string | null
          max_attendees?: number | null
          meeting_url?: string | null
          meta_description?: string | null
          meta_title?: string | null
          mrp?: number | null
          price: number
          price_includes_tax?: boolean
          product_info?: Json
          published_at?: string | null
          quantity?: number | null
          requires_approval?: boolean | null
          search_vector?: unknown
          shipping_required?: boolean | null
          shop_id: string
          sku?: string | null
          slug?: string | null
          stock?: number | null
          tags?: string[] | null
          tax_percent?: number | null
          title: string
          total_reviews?: number | null
          updated_at?: string
          weight?: number | null
        }
        Update: {
          average_rating?: number | null
          booking_duration_minutes?: number | null
          category?: string | null
          created_at?: string
          description?: string | null
          digital_file_size?: number | null
          digital_file_type?: string | null
          digital_file_url?: string | null
          dimensions?: Json | null
          download_limit?: number | null
          id?: string
          is_active?: boolean
          is_featured?: boolean
          is_online?: boolean | null
          listing_metadata?: Json
          listing_status?: Database["public"]["Enums"]["listing_status_enum"]
          listing_type?: Database["public"]["Enums"]["listing_type_enum"]
          location_id?: string | null
          max_attendees?: number | null
          meeting_url?: string | null
          meta_description?: string | null
          meta_title?: string | null
          mrp?: number | null
          price?: number
          price_includes_tax?: boolean
          product_info?: Json
          published_at?: string | null
          quantity?: number | null
          requires_approval?: boolean | null
          search_vector?: unknown
          shipping_required?: boolean | null
          shop_id?: string
          sku?: string | null
          slug?: string | null
          stock?: number | null
          tags?: string[] | null
          tax_percent?: number | null
          title?: string
          total_reviews?: number | null
          updated_at?: string
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "listings_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "addresses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listings_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "shop_addresses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listings_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "active_listings_view"
            referencedColumns: ["shop_id"]
          },
          {
            foreignKeyName: "listings_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "payment_analytics"
            referencedColumns: ["shop_id"]
          },
          {
            foreignKeyName: "listings_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shop_listings_summary"
            referencedColumns: ["shop_id"]
          },
          {
            foreignKeyName: "listings_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_analytics: {
        Row: {
          created_at: string | null
          hand_raises_count: number | null
          id: string
          meeting_id: string
          metadata: Json | null
          network_quality_average: number | null
          peak_participants: number | null
          recording_enabled: boolean | null
          screen_shares_count: number | null
          total_duration_seconds: number | null
          total_messages: number | null
          total_participants: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          hand_raises_count?: number | null
          id?: string
          meeting_id: string
          metadata?: Json | null
          network_quality_average?: number | null
          peak_participants?: number | null
          recording_enabled?: boolean | null
          screen_shares_count?: number | null
          total_duration_seconds?: number | null
          total_messages?: number | null
          total_participants?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          hand_raises_count?: number | null
          id?: string
          meeting_id?: string
          metadata?: Json | null
          network_quality_average?: number | null
          peak_participants?: number | null
          recording_enabled?: boolean | null
          screen_shares_count?: number | null
          total_duration_seconds?: number | null
          total_messages?: number | null
          total_participants?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      meeting_chat_messages: {
        Row: {
          created_at: string | null
          id: string
          is_deleted: boolean | null
          is_edited: boolean | null
          meeting_id: string
          message_text: string
          message_type: string
          metadata: Json | null
          room_id: string | null
          sender_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_deleted?: boolean | null
          is_edited?: boolean | null
          meeting_id: string
          message_text: string
          message_type?: string
          metadata?: Json | null
          room_id?: string | null
          sender_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_deleted?: boolean | null
          is_edited?: boolean | null
          meeting_id?: string
          message_text?: string
          message_type?: string
          metadata?: Json | null
          room_id?: string | null
          sender_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meeting_chat_messages_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["room_id"]
          },
        ]
      }
      meeting_control_events: {
        Row: {
          action: string
          actor_id: string
          created_at: string
          expires_at: string
          id: string
          meeting_id: string
          payload: Json
          target_user_id: string | null
        }
        Insert: {
          action: string
          actor_id: string
          created_at?: string
          expires_at?: string
          id?: string
          meeting_id: string
          payload?: Json
          target_user_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string
          created_at?: string
          expires_at?: string
          id?: string
          meeting_id?: string
          payload?: Json
          target_user_id?: string | null
        }
        Relationships: []
      }
      meeting_moderation_settings: {
        Row: {
          host_leave_behavior: string
          is_locked: boolean
          meeting_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          host_leave_behavior?: string
          is_locked?: boolean
          meeting_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          host_leave_behavior?: string
          is_locked?: boolean
          meeting_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      meeting_roles: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          meeting_id: string
          role: string
          updated_at: string
          user_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          meeting_id: string
          role: string
          updated_at?: string
          user_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          meeting_id?: string
          role?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      meeting_participants: {
        Row: {
          created_at: string | null
          display_name: string | null
          id: string
          is_host: boolean | null
          is_muted: boolean | null
          is_video_off: boolean | null
          joined_at: string | null
          last_seen_at: string | null
          left_at: string | null
          meeting_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          session_id: string | null
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          display_name?: string | null
          id?: string
          is_host?: boolean | null
          is_muted?: boolean | null
          is_video_off?: boolean | null
          joined_at?: string | null
          last_seen_at?: string | null
          left_at?: string | null
          meeting_id: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          session_id?: string | null
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          display_name?: string | null
          id?: string
          is_host?: boolean | null
          is_muted?: boolean | null
          is_video_off?: boolean | null
          joined_at?: string | null
          last_seen_at?: string | null
          left_at?: string | null
          meeting_id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          session_id?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_participants_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_participants_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_recording: {
        Row: {
          created_at: string | null
          created_by: string | null
          file_name: string | null
          file_path: string | null
          id: string
          meeting_id: string | null
          recording_ended_at: string | null
          recording_started_at: string | null
          room_id: string | null
          status: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          file_name?: string | null
          file_path?: string | null
          id?: string
          meeting_id?: string | null
          recording_ended_at?: string | null
          recording_started_at?: string | null
          room_id?: string | null
          status?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          file_name?: string | null
          file_path?: string | null
          id?: string
          meeting_id?: string | null
          recording_ended_at?: string | null
          recording_started_at?: string | null
          room_id?: string | null
          status?: string | null
        }
        Relationships: []
      }
      meeting_recordings: {
        Row: {
          created_at: string | null
          duration_seconds: number | null
          ended_at: string | null
          error_message: string | null
          file_size_bytes: number | null
          host_id: string | null
          id: string
          layout: string | null
          meeting_id: string
          recording_sid: string | null
          recording_url: string | null
          share_created_at: string | null
          share_revoked_at: string | null
          share_token_hash: string | null
          started_at: string | null
          status: string
          storage_path: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          duration_seconds?: number | null
          ended_at?: string | null
          error_message?: string | null
          file_size_bytes?: number | null
          host_id?: string | null
          id?: string
          layout?: string | null
          meeting_id: string
          recording_sid?: string | null
          recording_url?: string | null
          share_created_at?: string | null
          share_revoked_at?: string | null
          share_token_hash?: string | null
          started_at?: string | null
          status?: string
          storage_path?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          duration_seconds?: number | null
          ended_at?: string | null
          error_message?: string | null
          file_size_bytes?: number | null
          host_id?: string | null
          id?: string
          layout?: string | null
          meeting_id?: string
          recording_sid?: string | null
          recording_url?: string | null
          share_created_at?: string | null
          share_revoked_at?: string | null
          share_token_hash?: string | null
          started_at?: string | null
          status?: string
          storage_path?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meeting_recordings_host_id_fkey"
            columns: ["host_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_rooms: {
        Row: {
          activated_at: string | null
          created_at: string | null
          ended_at: string | null
          host_id: string
          id: string
          is_active: boolean | null
          max_participants: number | null
          meeting_id: string
          room_code: string
        }
        Insert: {
          activated_at?: string | null
          created_at?: string | null
          ended_at?: string | null
          host_id: string
          id?: string
          is_active?: boolean | null
          max_participants?: number | null
          meeting_id: string
          room_code: string
        }
        Update: {
          activated_at?: string | null
          created_at?: string | null
          ended_at?: string | null
          host_id?: string
          id?: string
          is_active?: boolean | null
          max_participants?: number | null
          meeting_id?: string
          room_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_rooms_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      meetings: {
        Row: {
          created_at: string | null
          description: string | null
          ended_at: string | null
          host_id: string
          id: string
          invitees: Json | null
          is_recurring: boolean | null
          max_participants: number | null
          meeting_code: string
          meeting_options: Json | null
          repeat: string | null
          room_id: string | null
          scheduled_at: string | null
          scheduled_end_at: string | null
          security_settings: Json | null
          started_at: string | null
          status: string
          time_zone: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          ended_at?: string | null
          host_id: string
          id?: string
          invitees?: Json | null
          is_recurring?: boolean | null
          max_participants?: number | null
          meeting_code?: string
          meeting_options?: Json | null
          repeat?: string | null
          room_id?: string | null
          scheduled_at?: string | null
          scheduled_end_at?: string | null
          security_settings?: Json | null
          started_at?: string | null
          status?: string
          time_zone?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          ended_at?: string | null
          host_id?: string
          id?: string
          invitees?: Json | null
          is_recurring?: boolean | null
          max_participants?: number | null
          meeting_code?: string
          meeting_options?: Json | null
          repeat?: string | null
          room_id?: string | null
          scheduled_at?: string | null
          scheduled_end_at?: string | null
          security_settings?: Json | null
          started_at?: string | null
          status?: string
          time_zone?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meetings_host_id_fkey"
            columns: ["host_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      message_poll_votes: {
        Row: {
          created_at: string
          id: string
          message_id: string
          option_index: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message_id: string
          option_index: number
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message_id?: string
          option_index?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_poll_votes_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      message_reactions: {
        Row: {
          created_at: string | null
          emoji: string
          id: string
          message_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          emoji: string
          id?: string
          message_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          emoji?: string
          id?: string
          message_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "message_reactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_reactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      message_reads: {
        Row: {
          conversation_id: string | null
          id: string
          read_at: string | null
          user_id: string | null
        }
        Insert: {
          conversation_id?: string | null
          id?: string
          read_at?: string | null
          user_id?: string | null
        }
        Update: {
          conversation_id?: string | null
          id?: string
          read_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "message_reads_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_reads_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      message_stars: {
        Row: {
          created_at: string
          message_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          message_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          message_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_stars_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      message_status: {
        Row: {
          id: string
          message_id: string | null
          status: string | null
          timestamp: string | null
          user_id: string | null
        }
        Insert: {
          id?: string
          message_id?: string | null
          status?: string | null
          timestamp?: string | null
          user_id?: string | null
        }
        Update: {
          id?: string
          message_id?: string | null
          status?: string | null
          timestamp?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "message_status_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_status_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string
          conversation_id: string | null
          created_at: string | null
          deleted_at: string | null
          edited_at: string | null
          file_name: string | null
          file_path: string | null
          file_size: number | null
          id: string
          media_type: string | null
          media_url: string | null
          message_type: string | null
          metadata: Json | null
          post_id: string | null
          reply_to_id: string | null
          sender_id: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          content: string
          conversation_id?: string | null
          created_at?: string | null
          deleted_at?: string | null
          edited_at?: string | null
          file_name?: string | null
          file_path?: string | null
          file_size?: number | null
          id?: string
          media_type?: string | null
          media_url?: string | null
          message_type?: string | null
          metadata?: Json | null
          post_id?: string | null
          reply_to_id?: string | null
          sender_id?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          content?: string
          conversation_id?: string | null
          created_at?: string | null
          deleted_at?: string | null
          edited_at?: string | null
          file_name?: string | null
          file_path?: string | null
          file_size?: number | null
          id?: string
          media_type?: string | null
          media_url?: string | null
          message_type?: string | null
          metadata?: Json | null
          post_id?: string | null
          reply_to_id?: string | null
          sender_id?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts_with_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_reply_to_id_fkey"
            columns: ["reply_to_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      network_email_invites: {
        Row: {
          created_at: string
          email: string
          id: string
          invitee_user_id: string | null
          inviter_id: string
          message: string | null
          status: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          invitee_user_id?: string | null
          inviter_id: string
          message?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          invitee_user_id?: string | null
          inviter_id?: string
          message?: string | null
          status?: string
        }
        Relationships: []
      }
      network_suggestions_digest_log: {
        Row: {
          created_at: string
          notification_id: string | null
          user_id: string
          week_key: string
        }
        Insert: {
          created_at?: string
          notification_id?: string | null
          user_id: string
          week_key: string
        }
        Update: {
          created_at?: string
          notification_id?: string | null
          user_id?: string
          week_key?: string
        }
        Relationships: []
      }
      newsletters: {
        Row: {
          created_at: string | null
          description: string
          frequency: string
          id: string
          image_url: string | null
          title: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          description: string
          frequency: string
          id?: string
          image_url?: string | null
          title: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string
          frequency?: string
          id?: string
          image_url?: string | null
          title?: string
          user_id?: string | null
        }
        Relationships: []
      }
      notification_batches: {
        Row: {
          actual_recipients: number | null
          batch_type: string
          completed_at: string | null
          created_at: string | null
          created_by: string | null
          delivered_count: number | null
          description: string | null
          error_message: string | null
          estimated_recipients: number | null
          failed_count: number | null
          id: string
          platform: string
          progress_percentage: number | null
          scheduled_for: string | null
          sent_count: number | null
          started_at: string | null
          status: string | null
          target_criteria: Json | null
          template_id: string | null
          title: string
        }
        Insert: {
          actual_recipients?: number | null
          batch_type: string
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          delivered_count?: number | null
          description?: string | null
          error_message?: string | null
          estimated_recipients?: number | null
          failed_count?: number | null
          id?: string
          platform?: string
          progress_percentage?: number | null
          scheduled_for?: string | null
          sent_count?: number | null
          started_at?: string | null
          status?: string | null
          target_criteria?: Json | null
          template_id?: string | null
          title: string
        }
        Update: {
          actual_recipients?: number | null
          batch_type?: string
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          delivered_count?: number | null
          description?: string | null
          error_message?: string | null
          estimated_recipients?: number | null
          failed_count?: number | null
          id?: string
          platform?: string
          progress_percentage?: number | null
          scheduled_for?: string | null
          sent_count?: number | null
          started_at?: string | null
          status?: string | null
          target_criteria?: Json | null
          template_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_batches_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "notification_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_contexts: {
        Row: {
          context_type: string
          created_at: string | null
          description: string | null
          display_name: string
          id: string
          is_active: boolean | null
          platform: string
          schema_definition: Json | null
          updated_at: string | null
        }
        Insert: {
          context_type: string
          created_at?: string | null
          description?: string | null
          display_name: string
          id?: string
          is_active?: boolean | null
          platform?: string
          schema_definition?: Json | null
          updated_at?: string | null
        }
        Update: {
          context_type?: string
          created_at?: string | null
          description?: string | null
          display_name?: string
          id?: string
          is_active?: boolean | null
          platform?: string
          schema_definition?: Json | null
          updated_at?: string | null
        }
        Relationships: []
      }
      notification_event_log: {
        Row: {
          channels: string[]
          created_at: string
          event_key: string
          id: string
          metadata: Json | null
          recipient_id: string
          template_key: string
        }
        Insert: {
          channels?: string[]
          created_at?: string
          event_key: string
          id?: string
          metadata?: Json | null
          recipient_id: string
          template_key: string
        }
        Update: {
          channels?: string[]
          created_at?: string
          event_key?: string
          id?: string
          metadata?: Json | null
          recipient_id?: string
          template_key?: string
        }
        Relationships: []
      }
      notification_event_queue: {
        Row: {
          attempts: number
          created_at: string
          event_key: string
          guest_session_id: string | null
          id: string
          last_error: string | null
          payload: Json
          processed_at: string | null
          recipient_id: string | null
          scheduled_for: string
          status: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          event_key: string
          guest_session_id?: string | null
          id?: string
          last_error?: string | null
          payload?: Json
          processed_at?: string | null
          recipient_id?: string | null
          scheduled_for: string
          status?: string
        }
        Update: {
          attempts?: number
          created_at?: string
          event_key?: string
          guest_session_id?: string | null
          id?: string
          last_error?: string | null
          payload?: Json
          processed_at?: string | null
          recipient_id?: string | null
          scheduled_for?: string
          status?: string
        }
        Relationships: []
      }
      notification_events: {
        Row: {
          channel: string
          error_message: string | null
          event_type: string
          id: string
          ip_address: unknown
          location_data: Json | null
          notification_id: string
          occurred_at: string | null
          processing_time_ms: number | null
          provider_response: Json | null
          queue_time_ms: number | null
          status: string
          user_agent: string | null
        }
        Insert: {
          channel: string
          error_message?: string | null
          event_type: string
          id?: string
          ip_address?: unknown
          location_data?: Json | null
          notification_id: string
          occurred_at?: string | null
          processing_time_ms?: number | null
          provider_response?: Json | null
          queue_time_ms?: number | null
          status: string
          user_agent?: string | null
        }
        Update: {
          channel?: string
          error_message?: string | null
          event_type?: string
          id?: string
          ip_address?: unknown
          location_data?: Json | null
          notification_id?: string
          occurred_at?: string | null
          processing_time_ms?: number | null
          provider_response?: Json | null
          queue_time_ms?: number | null
          status?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notification_events_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "notifications"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_logs: {
        Row: {
          created_at: string | null
          eligible_followers: number | null
          id: string
          metadata: Json | null
          notification_type: string
          recipients_count: number | null
          shop_id: string | null
          total_followers: number | null
        }
        Insert: {
          created_at?: string | null
          eligible_followers?: number | null
          id?: string
          metadata?: Json | null
          notification_type: string
          recipients_count?: number | null
          shop_id?: string | null
          total_followers?: number | null
        }
        Update: {
          created_at?: string | null
          eligible_followers?: number | null
          id?: string
          metadata?: Json | null
          notification_type?: string
          recipients_count?: number | null
          shop_id?: string | null
          total_followers?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "notification_logs_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "active_listings_view"
            referencedColumns: ["shop_id"]
          },
          {
            foreignKeyName: "notification_logs_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "payment_analytics"
            referencedColumns: ["shop_id"]
          },
          {
            foreignKeyName: "notification_logs_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shop_listings_summary"
            referencedColumns: ["shop_id"]
          },
          {
            foreignKeyName: "notification_logs_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          category: string
          created_at: string | null
          email_enabled: boolean | null
          frequency: string | null
          id: string
          in_app_enabled: boolean | null
          notification_type: string | null
          platform: string
          push_enabled: boolean | null
          quiet_hours_end: string | null
          quiet_hours_start: string | null
          sms_enabled: boolean | null
          timezone: string | null
          updated_at: string | null
          user_id: string
          whatsapp_enabled: boolean
        }
        Insert: {
          category?: string
          created_at?: string | null
          email_enabled?: boolean | null
          frequency?: string | null
          id?: string
          in_app_enabled?: boolean | null
          notification_type?: string | null
          platform?: string
          push_enabled?: boolean | null
          quiet_hours_end?: string | null
          quiet_hours_start?: string | null
          sms_enabled?: boolean | null
          timezone?: string | null
          updated_at?: string | null
          user_id: string
          whatsapp_enabled?: boolean
        }
        Update: {
          category?: string
          created_at?: string | null
          email_enabled?: boolean | null
          frequency?: string | null
          id?: string
          in_app_enabled?: boolean | null
          notification_type?: string | null
          platform?: string
          push_enabled?: boolean | null
          quiet_hours_end?: string | null
          quiet_hours_start?: string | null
          sms_enabled?: boolean | null
          timezone?: string | null
          updated_at?: string | null
          user_id?: string
          whatsapp_enabled?: boolean
        }
        Relationships: []
      }
      notification_routing_rules: {
        Row: {
          block_channels: string[] | null
          conditions: Json
          created_at: string | null
          created_by: string | null
          delay_minutes: number | null
          description: string | null
          force_channels: string[] | null
          id: string
          is_active: boolean | null
          merge_window_minutes: number | null
          platform: string
          priority: number | null
          rule_name: string
        }
        Insert: {
          block_channels?: string[] | null
          conditions: Json
          created_at?: string | null
          created_by?: string | null
          delay_minutes?: number | null
          description?: string | null
          force_channels?: string[] | null
          id?: string
          is_active?: boolean | null
          merge_window_minutes?: number | null
          platform?: string
          priority?: number | null
          rule_name: string
        }
        Update: {
          block_channels?: string[] | null
          conditions?: Json
          created_at?: string | null
          created_by?: string | null
          delay_minutes?: number | null
          description?: string | null
          force_channels?: string[] | null
          id?: string
          is_active?: boolean | null
          merge_window_minutes?: number | null
          platform?: string
          priority?: number | null
          rule_name?: string
        }
        Relationships: []
      }
      notification_templates: {
        Row: {
          action_button_text: string | null
          action_url_template: string | null
          category: string
          created_at: string | null
          created_by: string | null
          default_channels: string[] | null
          default_priority: number | null
          email_body_template: string | null
          email_subject_template: string | null
          id: string
          is_active: boolean | null
          message_template: string
          platform: string
          push_body_template: string | null
          push_title_template: string | null
          required_variables: Json | null
          sms_template: string | null
          supports_html: boolean | null
          supports_markdown: boolean | null
          template_key: string
          title_template: string
          updated_at: string | null
          variables: Json | null
          version: number | null
          whatsapp_template: string | null
        }
        Insert: {
          action_button_text?: string | null
          action_url_template?: string | null
          category?: string
          created_at?: string | null
          created_by?: string | null
          default_channels?: string[] | null
          default_priority?: number | null
          email_body_template?: string | null
          email_subject_template?: string | null
          id?: string
          is_active?: boolean | null
          message_template: string
          platform?: string
          push_body_template?: string | null
          push_title_template?: string | null
          required_variables?: Json | null
          sms_template?: string | null
          supports_html?: boolean | null
          supports_markdown?: boolean | null
          template_key: string
          title_template: string
          updated_at?: string | null
          variables?: Json | null
          version?: number | null
          whatsapp_template?: string | null
        }
        Update: {
          action_button_text?: string | null
          action_url_template?: string | null
          category?: string
          created_at?: string | null
          created_by?: string | null
          default_channels?: string[] | null
          default_priority?: number | null
          email_body_template?: string | null
          email_subject_template?: string | null
          id?: string
          is_active?: boolean | null
          message_template?: string
          platform?: string
          push_body_template?: string | null
          push_title_template?: string | null
          required_variables?: Json | null
          sms_template?: string | null
          supports_html?: boolean | null
          supports_markdown?: boolean | null
          template_key?: string
          title_template?: string
          updated_at?: string | null
          variables?: Json | null
          version?: number | null
          whatsapp_template?: string | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          action_taken: string | null
          action_url: string | null
          audience_type: string | null
          category: string
          channels: string[] | null
          clicked_at: string | null
          context_id: string | null
          context_type: string | null
          created_at: string | null
          created_by: string | null
          data: Json | null
          delivered_at: string | null
          delivery_attempts: Json | null
          delivery_status: Json | null
          dismissed_at: string | null
          expires_at: string | null
          group_key: string | null
          id: string
          image_url: string | null
          message: string
          metadata: Json | null
          parent_context_id: string | null
          parent_context_type: string | null
          parent_notification_id: string | null
          platform: string
          priority: number | null
          read: boolean | null
          read_at: string | null
          recipient_id: string
          scheduled_for: string | null
          segment_criteria: Json | null
          source_system: string | null
          template_id: string | null
          thread_id: string | null
          title: string
          type: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          action_taken?: string | null
          action_url?: string | null
          audience_type?: string | null
          category?: string
          channels?: string[] | null
          clicked_at?: string | null
          context_id?: string | null
          context_type?: string | null
          created_at?: string | null
          created_by?: string | null
          data?: Json | null
          delivered_at?: string | null
          delivery_attempts?: Json | null
          delivery_status?: Json | null
          dismissed_at?: string | null
          expires_at?: string | null
          group_key?: string | null
          id?: string
          image_url?: string | null
          message: string
          metadata?: Json | null
          parent_context_id?: string | null
          parent_context_type?: string | null
          parent_notification_id?: string | null
          platform?: string
          priority?: number | null
          read?: boolean | null
          read_at?: string | null
          recipient_id: string
          scheduled_for?: string | null
          segment_criteria?: Json | null
          source_system?: string | null
          template_id?: string | null
          thread_id?: string | null
          title: string
          type: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          action_taken?: string | null
          action_url?: string | null
          audience_type?: string | null
          category?: string
          channels?: string[] | null
          clicked_at?: string | null
          context_id?: string | null
          context_type?: string | null
          created_at?: string | null
          created_by?: string | null
          data?: Json | null
          delivered_at?: string | null
          delivery_attempts?: Json | null
          delivery_status?: Json | null
          dismissed_at?: string | null
          expires_at?: string | null
          group_key?: string | null
          id?: string
          image_url?: string | null
          message?: string
          metadata?: Json | null
          parent_context_id?: string | null
          parent_context_type?: string | null
          parent_notification_id?: string | null
          platform?: string
          priority?: number | null
          read?: boolean | null
          read_at?: string | null
          recipient_id?: string
          scheduled_for?: string | null
          segment_criteria?: Json | null
          source_system?: string | null
          template_id?: string | null
          thread_id?: string | null
          title?: string
          type?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_parent_notification_id_fkey"
            columns: ["parent_notification_id"]
            isOneToOne: false
            referencedRelation: "notifications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "notification_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      order_delivery: {
        Row: {
          actual_delivery_date: string | null
          awb_code: string | null
          carrier_name: string | null
          carrier_tracking_url: string | null
          courier_service_name: string | null
          created_at: string
          delivered_at: string | null
          delivery_address: Json
          delivery_instructions: string | null
          delivery_metadata: Json
          delivery_mode: string
          delivery_otp: string | null
          delivery_person_name: string | null
          delivery_person_phone: string | null
          delivery_photo_url: string | null
          delivery_signature_url: string | null
          delivery_status: Database["public"]["Enums"]["delivery_status_enum"]
          delivery_time_slot: string | null
          dimensions_actual: Json | null
          estimated_delivery_date: string | null
          id: string
          invoice_url: string | null
          label_url: string | null
          listing_delivery_profile_id: string | null
          manifest_url: string | null
          order_id: string
          order_item_id: string | null
          pickup_scheduled_date: string | null
          shipment_id: string | null
          shipped_at: string | null
          shipping_cost: number | null
          shipping_provider_id: string | null
          shiprocket_order_id: string | null
          status_history: Json | null
          tracking_number: string | null
          updated_at: string
          weight_actual: number | null
        }
        Insert: {
          actual_delivery_date?: string | null
          awb_code?: string | null
          carrier_name?: string | null
          carrier_tracking_url?: string | null
          courier_service_name?: string | null
          created_at?: string
          delivered_at?: string | null
          delivery_address: Json
          delivery_instructions?: string | null
          delivery_metadata?: Json
          delivery_mode: string
          delivery_otp?: string | null
          delivery_person_name?: string | null
          delivery_person_phone?: string | null
          delivery_photo_url?: string | null
          delivery_signature_url?: string | null
          delivery_status?: Database["public"]["Enums"]["delivery_status_enum"]
          delivery_time_slot?: string | null
          dimensions_actual?: Json | null
          estimated_delivery_date?: string | null
          id?: string
          invoice_url?: string | null
          label_url?: string | null
          listing_delivery_profile_id?: string | null
          manifest_url?: string | null
          order_id: string
          order_item_id?: string | null
          pickup_scheduled_date?: string | null
          shipment_id?: string | null
          shipped_at?: string | null
          shipping_cost?: number | null
          shipping_provider_id?: string | null
          shiprocket_order_id?: string | null
          status_history?: Json | null
          tracking_number?: string | null
          updated_at?: string
          weight_actual?: number | null
        }
        Update: {
          actual_delivery_date?: string | null
          awb_code?: string | null
          carrier_name?: string | null
          carrier_tracking_url?: string | null
          courier_service_name?: string | null
          created_at?: string
          delivered_at?: string | null
          delivery_address?: Json
          delivery_instructions?: string | null
          delivery_metadata?: Json
          delivery_mode?: string
          delivery_otp?: string | null
          delivery_person_name?: string | null
          delivery_person_phone?: string | null
          delivery_photo_url?: string | null
          delivery_signature_url?: string | null
          delivery_status?: Database["public"]["Enums"]["delivery_status_enum"]
          delivery_time_slot?: string | null
          dimensions_actual?: Json | null
          estimated_delivery_date?: string | null
          id?: string
          invoice_url?: string | null
          label_url?: string | null
          listing_delivery_profile_id?: string | null
          manifest_url?: string | null
          order_id?: string
          order_item_id?: string | null
          pickup_scheduled_date?: string | null
          shipment_id?: string | null
          shipped_at?: string | null
          shipping_cost?: number | null
          shipping_provider_id?: string | null
          shiprocket_order_id?: string | null
          status_history?: Json | null
          tracking_number?: string | null
          updated_at?: string
          weight_actual?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "order_delivery_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "customer_order_history_view"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "order_delivery_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "customer_orders_view"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "order_delivery_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_delivery_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_delivery_shipping_provider_id_fkey"
            columns: ["shipping_provider_id"]
            isOneToOne: false
            referencedRelation: "shipping_providers"
            referencedColumns: ["id"]
          },
        ]
      }
      order_discounts: {
        Row: {
          applied_at: string
          applied_by_code: boolean | null
          discount_amount: number
          discount_metadata: Json
          discount_name: string
          discount_profile_id: string | null
          discount_scope: string | null
          discount_type: string
          id: string
          listing_discount_id: string | null
          order_item_id: string
        }
        Insert: {
          applied_at?: string
          applied_by_code?: boolean | null
          discount_amount: number
          discount_metadata?: Json
          discount_name: string
          discount_profile_id?: string | null
          discount_scope?: string | null
          discount_type: string
          id?: string
          listing_discount_id?: string | null
          order_item_id: string
        }
        Update: {
          applied_at?: string
          applied_by_code?: boolean | null
          discount_amount?: number
          discount_metadata?: Json
          discount_name?: string
          discount_profile_id?: string | null
          discount_scope?: string | null
          discount_type?: string
          id?: string
          listing_discount_id?: string | null
          order_item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_discounts_discount_profile_id_fkey"
            columns: ["discount_profile_id"]
            isOneToOne: false
            referencedRelation: "discount_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_discounts_listing_discount_id_fkey"
            columns: ["listing_discount_id"]
            isOneToOne: false
            referencedRelation: "listing_discounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_discounts_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
        ]
      }
      order_fulfillments: {
        Row: {
          adult_signature_required: boolean | null
          attempt_count: number | null
          automation_rules_applied: Json | null
          carrier_code: string | null
          carrier_metadata: Json | null
          carrier_name: string | null
          carrier_service_code: string | null
          carrier_service_name: string | null
          created_at: string
          customer_notifications: Json | null
          delivered_at: string | null
          delivery_confirmation_method: string | null
          delivery_instructions: string | null
          delivery_photo_url: string | null
          delivery_signature_url: string | null
          estimated_delivery_date: string | null
          estimated_ship_date: string | null
          external_fulfillment_id: string | null
          fulfilled_by: string
          fulfillment_center_id: string | null
          fulfillment_center_name: string | null
          fulfillment_cost: number | null
          fulfillment_metadata: Json
          fulfillment_method: string | null
          fulfillment_notes: string | null
          fulfillment_number: string
          fulfillment_status: Database["public"]["Enums"]["fulfillment_status_enum"]
          id: string
          insurance_cost: number | null
          insurance_value: number | null
          internal_notes: string | null
          last_failure_at: string | null
          last_failure_reason: string | null
          latest_delivery_date: string | null
          master_tracking_number: string | null
          max_attempts: number | null
          next_retry_at: string | null
          order_item_id: string
          package_dimensions_cm: string | null
          package_type: string | null
          package_weight_grams: number | null
          packaging_cost: number | null
          parent_fulfillment_id: string | null
          pick_location: string | null
          priority_level: number | null
          promised_delivery_date: string | null
          quantity_delivered: number
          quantity_fulfilled: number
          quantity_returned: number
          quantity_shipped: number
          quantity_to_fulfill: number
          return_authorized_at: string | null
          return_carrier_name: string | null
          return_condition: string | null
          return_reason: string | null
          return_received_at: string | null
          return_tracking_number: string | null
          returned_at: string | null
          shipped_at: string | null
          shipping_address_validated: boolean | null
          shipping_cost: number | null
          shipping_label_url: string | null
          signature_required: boolean | null
          special_handling_instructions: string | null
          tracking_number: string | null
          updated_at: string
          wave_id: string | null
        }
        Insert: {
          adult_signature_required?: boolean | null
          attempt_count?: number | null
          automation_rules_applied?: Json | null
          carrier_code?: string | null
          carrier_metadata?: Json | null
          carrier_name?: string | null
          carrier_service_code?: string | null
          carrier_service_name?: string | null
          created_at?: string
          customer_notifications?: Json | null
          delivered_at?: string | null
          delivery_confirmation_method?: string | null
          delivery_instructions?: string | null
          delivery_photo_url?: string | null
          delivery_signature_url?: string | null
          estimated_delivery_date?: string | null
          estimated_ship_date?: string | null
          external_fulfillment_id?: string | null
          fulfilled_by: string
          fulfillment_center_id?: string | null
          fulfillment_center_name?: string | null
          fulfillment_cost?: number | null
          fulfillment_metadata?: Json
          fulfillment_method?: string | null
          fulfillment_notes?: string | null
          fulfillment_number: string
          fulfillment_status?: Database["public"]["Enums"]["fulfillment_status_enum"]
          id?: string
          insurance_cost?: number | null
          insurance_value?: number | null
          internal_notes?: string | null
          last_failure_at?: string | null
          last_failure_reason?: string | null
          latest_delivery_date?: string | null
          master_tracking_number?: string | null
          max_attempts?: number | null
          next_retry_at?: string | null
          order_item_id: string
          package_dimensions_cm?: string | null
          package_type?: string | null
          package_weight_grams?: number | null
          packaging_cost?: number | null
          parent_fulfillment_id?: string | null
          pick_location?: string | null
          priority_level?: number | null
          promised_delivery_date?: string | null
          quantity_delivered?: number
          quantity_fulfilled?: number
          quantity_returned?: number
          quantity_shipped?: number
          quantity_to_fulfill: number
          return_authorized_at?: string | null
          return_carrier_name?: string | null
          return_condition?: string | null
          return_reason?: string | null
          return_received_at?: string | null
          return_tracking_number?: string | null
          returned_at?: string | null
          shipped_at?: string | null
          shipping_address_validated?: boolean | null
          shipping_cost?: number | null
          shipping_label_url?: string | null
          signature_required?: boolean | null
          special_handling_instructions?: string | null
          tracking_number?: string | null
          updated_at?: string
          wave_id?: string | null
        }
        Update: {
          adult_signature_required?: boolean | null
          attempt_count?: number | null
          automation_rules_applied?: Json | null
          carrier_code?: string | null
          carrier_metadata?: Json | null
          carrier_name?: string | null
          carrier_service_code?: string | null
          carrier_service_name?: string | null
          created_at?: string
          customer_notifications?: Json | null
          delivered_at?: string | null
          delivery_confirmation_method?: string | null
          delivery_instructions?: string | null
          delivery_photo_url?: string | null
          delivery_signature_url?: string | null
          estimated_delivery_date?: string | null
          estimated_ship_date?: string | null
          external_fulfillment_id?: string | null
          fulfilled_by?: string
          fulfillment_center_id?: string | null
          fulfillment_center_name?: string | null
          fulfillment_cost?: number | null
          fulfillment_metadata?: Json
          fulfillment_method?: string | null
          fulfillment_notes?: string | null
          fulfillment_number?: string
          fulfillment_status?: Database["public"]["Enums"]["fulfillment_status_enum"]
          id?: string
          insurance_cost?: number | null
          insurance_value?: number | null
          internal_notes?: string | null
          last_failure_at?: string | null
          last_failure_reason?: string | null
          latest_delivery_date?: string | null
          master_tracking_number?: string | null
          max_attempts?: number | null
          next_retry_at?: string | null
          order_item_id?: string
          package_dimensions_cm?: string | null
          package_type?: string | null
          package_weight_grams?: number | null
          packaging_cost?: number | null
          parent_fulfillment_id?: string | null
          pick_location?: string | null
          priority_level?: number | null
          promised_delivery_date?: string | null
          quantity_delivered?: number
          quantity_fulfilled?: number
          quantity_returned?: number
          quantity_shipped?: number
          quantity_to_fulfill?: number
          return_authorized_at?: string | null
          return_carrier_name?: string | null
          return_condition?: string | null
          return_reason?: string | null
          return_received_at?: string | null
          return_tracking_number?: string | null
          returned_at?: string | null
          shipped_at?: string | null
          shipping_address_validated?: boolean | null
          shipping_cost?: number | null
          shipping_label_url?: string | null
          signature_required?: boolean | null
          special_handling_instructions?: string | null
          tracking_number?: string | null
          updated_at?: string
          wave_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_fulfillments_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_fulfillments_parent_fulfillment_id_fkey"
            columns: ["parent_fulfillment_id"]
            isOneToOne: false
            referencedRelation: "order_fulfillments"
            referencedColumns: ["id"]
          },
        ]
      }
      order_issue_comments: {
        Row: {
          author_id: string
          body: string
          created_at: string
          id: string
          issue_id: string
          updated_at: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          id?: string
          issue_id: string
          updated_at?: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          id?: string
          issue_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_issue_comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_issue_comments_issue_id_fkey"
            columns: ["issue_id"]
            isOneToOne: false
            referencedRelation: "order_issues"
            referencedColumns: ["id"]
          },
        ]
      }
      order_issue_events: {
        Row: {
          actor_id: string | null
          created_at: string
          event_type: string
          id: string
          issue_id: string
          metadata: Json
          note: string | null
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          event_type: string
          id?: string
          issue_id: string
          metadata?: Json
          note?: string | null
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          event_type?: string
          id?: string
          issue_id?: string
          metadata?: Json
          note?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_issue_events_issue_id_fkey"
            columns: ["issue_id"]
            isOneToOne: false
            referencedRelation: "order_issues"
            referencedColumns: ["id"]
          },
        ]
      }
      order_issues: {
        Row: {
          assigned_to: string | null
          closed_at: string | null
          created_at: string
          description: string
          evidence_urls: string[] | null
          id: string
          issue_priority: string | null
          issue_title: string
          issue_type: string
          order_id: string
          order_item_id: string | null
          reject_reason_code: string | null
          reported_by: string | null
          resolution_action: string | null
          resolution_note: string | null
          resolved_at: string | null
          return_assigned_by: string | null
          return_courier_slug: string | null
          return_shipped_at: string | null
          return_shipping_mode: string | null
          return_tracking_number: string | null
          return_tracking_url: string | null
          status: string | null
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          closed_at?: string | null
          created_at?: string
          description: string
          evidence_urls?: string[] | null
          id?: string
          issue_priority?: string | null
          issue_title: string
          issue_type: string
          order_id: string
          order_item_id?: string | null
          reject_reason_code?: string | null
          reported_by?: string | null
          resolution_action?: string | null
          resolution_note?: string | null
          resolved_at?: string | null
          return_assigned_by?: string | null
          return_courier_slug?: string | null
          return_shipped_at?: string | null
          return_shipping_mode?: string | null
          return_tracking_number?: string | null
          return_tracking_url?: string | null
          status?: string | null
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          closed_at?: string | null
          created_at?: string
          description?: string
          evidence_urls?: string[] | null
          id?: string
          issue_priority?: string | null
          issue_title?: string
          issue_type?: string
          order_id?: string
          order_item_id?: string | null
          reject_reason_code?: string | null
          reported_by?: string | null
          resolution_action?: string | null
          resolution_note?: string | null
          resolved_at?: string | null
          return_assigned_by?: string | null
          return_courier_slug?: string | null
          return_shipped_at?: string | null
          return_shipping_mode?: string | null
          return_tracking_number?: string | null
          return_tracking_url?: string | null
          status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_reported_by"
            columns: ["reported_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_issues_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "customer_order_history_view"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "order_issues_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "customer_orders_view"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "order_issues_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_issues_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          created_at: string
          digital_download_url: string | null
          download_attempts: number | null
          download_expires_at: string | null
          exchanged_from_item_id: string | null
          has_review: boolean | null
          id: string
          item_discount_amount: number | null
          item_status: Database["public"]["Enums"]["order_status_enum"]
          listing_id: string
          listing_return_policy_id: string | null
          order_id: string
          product_description: string | null
          product_sku: string | null
          product_title: string
          quantity: number
          total_price: number
          unit_price: number
          updated_at: string
          variation_details: Json | null
          vendor_id: string
        }
        Insert: {
          created_at?: string
          digital_download_url?: string | null
          download_attempts?: number | null
          download_expires_at?: string | null
          exchanged_from_item_id?: string | null
          has_review?: boolean | null
          id?: string
          item_discount_amount?: number | null
          item_status?: Database["public"]["Enums"]["order_status_enum"]
          listing_id: string
          listing_return_policy_id?: string | null
          order_id: string
          product_description?: string | null
          product_sku?: string | null
          product_title: string
          quantity: number
          total_price: number
          unit_price: number
          updated_at?: string
          variation_details?: Json | null
          vendor_id: string
        }
        Update: {
          created_at?: string
          digital_download_url?: string | null
          download_attempts?: number | null
          download_expires_at?: string | null
          exchanged_from_item_id?: string | null
          has_review?: boolean | null
          id?: string
          item_discount_amount?: number | null
          item_status?: Database["public"]["Enums"]["order_status_enum"]
          listing_id?: string
          listing_return_policy_id?: string | null
          order_id?: string
          product_description?: string | null
          product_sku?: string | null
          product_title?: string
          quantity?: number
          total_price?: number
          unit_price?: number
          updated_at?: string
          variation_details?: Json | null
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_items_exchanged_from_item_id_fkey"
            columns: ["exchanged_from_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "active_listings_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "active_listings_with_shop"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listing_details_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_listing_return_policy_id_fkey"
            columns: ["listing_return_policy_id"]
            isOneToOne: false
            referencedRelation: "return_policies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "customer_order_history_view"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "customer_orders_view"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "active_listings_view"
            referencedColumns: ["shop_id"]
          },
          {
            foreignKeyName: "order_items_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "payment_analytics"
            referencedColumns: ["shop_id"]
          },
          {
            foreignKeyName: "order_items_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "shop_listings_summary"
            referencedColumns: ["shop_id"]
          },
          {
            foreignKeyName: "order_items_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      order_payments: {
        Row: {
          amount: number
          cod_amount: number | null
          cod_collected_at: string | null
          cod_collected_by: string | null
          created_at: string
          failure_code: string | null
          failure_reason: string | null
          gateway_transaction_id: string | null
          id: string
          order_id: string
          payment_gateway: string | null
          payment_metadata: Json
          payment_mode: Database["public"]["Enums"]["payment_mode_enum"]
          payment_status: Database["public"]["Enums"]["payment_status_enum"]
          processed_at: string | null
          transaction_id: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          cod_amount?: number | null
          cod_collected_at?: string | null
          cod_collected_by?: string | null
          created_at?: string
          failure_code?: string | null
          failure_reason?: string | null
          gateway_transaction_id?: string | null
          id?: string
          order_id: string
          payment_gateway?: string | null
          payment_metadata?: Json
          payment_mode: Database["public"]["Enums"]["payment_mode_enum"]
          payment_status?: Database["public"]["Enums"]["payment_status_enum"]
          processed_at?: string | null
          transaction_id?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          cod_amount?: number | null
          cod_collected_at?: string | null
          cod_collected_by?: string | null
          created_at?: string
          failure_code?: string | null
          failure_reason?: string | null
          gateway_transaction_id?: string | null
          id?: string
          order_id?: string
          payment_gateway?: string | null
          payment_metadata?: Json
          payment_mode?: Database["public"]["Enums"]["payment_mode_enum"]
          payment_status?: Database["public"]["Enums"]["payment_status_enum"]
          processed_at?: string | null
          transaction_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "customer_order_history_view"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "order_payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "customer_orders_view"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "order_payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_status_logs: {
        Row: {
          change_metadata: Json
          change_reason: string | null
          changed_at: string
          changed_by: string | null
          from_status: Database["public"]["Enums"]["order_status_enum"] | null
          id: string
          note: string | null
          order_id: string
          system_generated: boolean
          to_status: Database["public"]["Enums"]["order_status_enum"]
        }
        Insert: {
          change_metadata?: Json
          change_reason?: string | null
          changed_at?: string
          changed_by?: string | null
          from_status?: Database["public"]["Enums"]["order_status_enum"] | null
          id?: string
          note?: string | null
          order_id: string
          system_generated?: boolean
          to_status: Database["public"]["Enums"]["order_status_enum"]
        }
        Update: {
          change_metadata?: Json
          change_reason?: string | null
          changed_at?: string
          changed_by?: string | null
          from_status?: Database["public"]["Enums"]["order_status_enum"] | null
          id?: string
          note?: string | null
          order_id?: string
          system_generated?: boolean
          to_status?: Database["public"]["Enums"]["order_status_enum"]
        }
        Relationships: [
          {
            foreignKeyName: "order_status_logs_changed_by_fkey1"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_status_logs_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "customer_order_history_view"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "order_status_logs_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "customer_orders_view"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "order_status_logs_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_tax: {
        Row: {
          created_at: string
          id: string
          order_id: string
          order_item_id: string | null
          tax_amount: number
          tax_id: string
          tax_metadata: Json
          tax_name: string
          tax_rate: number
          tax_type: string
          taxable_amount: number
        }
        Insert: {
          created_at?: string
          id?: string
          order_id: string
          order_item_id?: string | null
          tax_amount: number
          tax_id: string
          tax_metadata?: Json
          tax_name: string
          tax_rate: number
          tax_type: string
          taxable_amount: number
        }
        Update: {
          created_at?: string
          id?: string
          order_id?: string
          order_item_id?: string | null
          tax_amount?: number
          tax_id?: string
          tax_metadata?: Json
          tax_name?: string
          tax_rate?: number
          tax_type?: string
          taxable_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_tax_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "customer_order_history_view"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "order_tax_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "customer_orders_view"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "order_tax_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_tax_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_tax_tax_id_fkey"
            columns: ["tax_id"]
            isOneToOne: false
            referencedRelation: "taxes"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          billing_address_id: string | null
          completed_at: string | null
          confirmed_at: string | null
          created_at: string
          currency: string
          customer_country: string | null
          customer_currency: string | null
          customer_discount_amount: number | null
          customer_notes: string | null
          customer_shipping_amount: number | null
          customer_subtotal_amount: number | null
          customer_tax_amount: number | null
          customer_total_amount: number | null
          delivered_at: string | null
          discount_amount: number | null
          estimated_delivery_date: string | null
          id: string
          order_metadata: Json
          order_number: string
          order_source: string | null
          order_status: Database["public"]["Enums"]["order_status_enum"]
          payment_required: boolean
          requested_delivery_date: string | null
          shipped_at: string | null
          shipping_address_id: string | null
          shipping_amount: number | null
          special_instructions: string | null
          status: string | null
          subtotal_amount: number
          tax_amount: number | null
          total_amount: number
          updated_at: string
          user_id: string
        }
        Insert: {
          billing_address_id?: string | null
          completed_at?: string | null
          confirmed_at?: string | null
          created_at?: string
          currency?: string
          customer_country?: string | null
          customer_currency?: string | null
          customer_discount_amount?: number | null
          customer_notes?: string | null
          customer_shipping_amount?: number | null
          customer_subtotal_amount?: number | null
          customer_tax_amount?: number | null
          customer_total_amount?: number | null
          delivered_at?: string | null
          discount_amount?: number | null
          estimated_delivery_date?: string | null
          id?: string
          order_metadata?: Json
          order_number: string
          order_source?: string | null
          order_status?: Database["public"]["Enums"]["order_status_enum"]
          payment_required?: boolean
          requested_delivery_date?: string | null
          shipped_at?: string | null
          shipping_address_id?: string | null
          shipping_amount?: number | null
          special_instructions?: string | null
          status?: string | null
          subtotal_amount: number
          tax_amount?: number | null
          total_amount: number
          updated_at?: string
          user_id: string
        }
        Update: {
          billing_address_id?: string | null
          completed_at?: string | null
          confirmed_at?: string | null
          created_at?: string
          currency?: string
          customer_country?: string | null
          customer_currency?: string | null
          customer_discount_amount?: number | null
          customer_notes?: string | null
          customer_shipping_amount?: number | null
          customer_subtotal_amount?: number | null
          customer_tax_amount?: number | null
          customer_total_amount?: number | null
          delivered_at?: string | null
          discount_amount?: number | null
          estimated_delivery_date?: string | null
          id?: string
          order_metadata?: Json
          order_number?: string
          order_source?: string | null
          order_status?: Database["public"]["Enums"]["order_status_enum"]
          payment_required?: boolean
          requested_delivery_date?: string | null
          shipped_at?: string | null
          shipping_address_id?: string | null
          shipping_amount?: number | null
          special_instructions?: string | null
          status?: string | null
          subtotal_amount?: number
          tax_amount?: number | null
          total_amount?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_billing_address_id_fkey"
            columns: ["billing_address_id"]
            isOneToOne: false
            referencedRelation: "addresses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_billing_address_id_fkey"
            columns: ["billing_address_id"]
            isOneToOne: false
            referencedRelation: "shop_addresses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_shipping_address_id_fkey"
            columns: ["shipping_address_id"]
            isOneToOne: false
            referencedRelation: "addresses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_shipping_address_id_fkey"
            columns: ["shipping_address_id"]
            isOneToOne: false
            referencedRelation: "shop_addresses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_user_id_fkey1"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      page_presence: {
        Row: {
          actor_id: string | null
          device_id: string | null
          id: string
          is_guest: boolean | null
          joined_at: string | null
          last_seen: string | null
          page: string
          path: string | null
          query: Json | null
          session_id: string | null
          user_id: string | null
        }
        Insert: {
          actor_id?: string | null
          device_id?: string | null
          id?: string
          is_guest?: boolean | null
          joined_at?: string | null
          last_seen?: string | null
          page: string
          path?: string | null
          query?: Json | null
          session_id?: string | null
          user_id?: string | null
        }
        Update: {
          actor_id?: string | null
          device_id?: string | null
          id?: string
          is_guest?: boolean | null
          joined_at?: string | null
          last_seen?: string | null
          page?: string
          path?: string | null
          query?: Json | null
          session_id?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      page_views: {
        Row: {
          company_id: string | null
          created_at: string | null
          id: string
          profile_id: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string | null
          id?: string
          profile_id?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string | null
          id?: string
          profile_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "page_views_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companypages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "page_views_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_logs: {
        Row: {
          amount: number | null
          created_at: string | null
          currency: string | null
          error_code: string | null
          error_message: string | null
          event_type: Database["public"]["Enums"]["payment_log_event_type_enum"]
          id: string
          logged_at: string | null
          order_payment_id: string | null
          payload: Json | null
          processed_at: string | null
          provider: Database["public"]["Enums"]["payment_provider_enum"] | null
          shop_id: string | null
          status: Database["public"]["Enums"]["payment_log_status_enum"]
          transaction_id: string | null
          updated_at: string | null
        }
        Insert: {
          amount?: number | null
          created_at?: string | null
          currency?: string | null
          error_code?: string | null
          error_message?: string | null
          event_type: Database["public"]["Enums"]["payment_log_event_type_enum"]
          id?: string
          logged_at?: string | null
          order_payment_id?: string | null
          payload?: Json | null
          processed_at?: string | null
          provider?: Database["public"]["Enums"]["payment_provider_enum"] | null
          shop_id?: string | null
          status: Database["public"]["Enums"]["payment_log_status_enum"]
          transaction_id?: string | null
          updated_at?: string | null
        }
        Update: {
          amount?: number | null
          created_at?: string | null
          currency?: string | null
          error_code?: string | null
          error_message?: string | null
          event_type?: Database["public"]["Enums"]["payment_log_event_type_enum"]
          id?: string
          logged_at?: string | null
          order_payment_id?: string | null
          payload?: Json | null
          processed_at?: string | null
          provider?: Database["public"]["Enums"]["payment_provider_enum"] | null
          shop_id?: string | null
          status?: Database["public"]["Enums"]["payment_log_status_enum"]
          transaction_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_logs_order_payment_id_fkey"
            columns: ["order_payment_id"]
            isOneToOne: false
            referencedRelation: "order_payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_logs_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "active_listings_view"
            referencedColumns: ["shop_id"]
          },
          {
            foreignKeyName: "payment_logs_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "payment_analytics"
            referencedColumns: ["shop_id"]
          },
          {
            foreignKeyName: "payment_logs_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shop_listings_summary"
            referencedColumns: ["shop_id"]
          },
          {
            foreignKeyName: "payment_logs_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_webhooks: {
        Row: {
          created_at: string | null
          error_message: string | null
          event_type: string
          id: string
          last_retry_at: string | null
          payload: Json
          processed: boolean | null
          processed_at: string | null
          provider: Database["public"]["Enums"]["payment_provider_enum"]
          retry_count: number | null
          shop_id: string
          signature: string | null
          updated_at: string | null
          webhook_id: string
        }
        Insert: {
          created_at?: string | null
          error_message?: string | null
          event_type: string
          id?: string
          last_retry_at?: string | null
          payload?: Json
          processed?: boolean | null
          processed_at?: string | null
          provider: Database["public"]["Enums"]["payment_provider_enum"]
          retry_count?: number | null
          shop_id: string
          signature?: string | null
          updated_at?: string | null
          webhook_id: string
        }
        Update: {
          created_at?: string | null
          error_message?: string | null
          event_type?: string
          id?: string
          last_retry_at?: string | null
          payload?: Json
          processed?: boolean | null
          processed_at?: string | null
          provider?: Database["public"]["Enums"]["payment_provider_enum"]
          retry_count?: number | null
          shop_id?: string
          signature?: string | null
          updated_at?: string | null
          webhook_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_webhooks_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "active_listings_view"
            referencedColumns: ["shop_id"]
          },
          {
            foreignKeyName: "payment_webhooks_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "payment_analytics"
            referencedColumns: ["shop_id"]
          },
          {
            foreignKeyName: "payment_webhooks_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shop_listings_summary"
            referencedColumns: ["shop_id"]
          },
          {
            foreignKeyName: "payment_webhooks_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      phone_otp: {
        Row: {
          attempts: number
          created_at: string
          expires_at: string
          id: string
          otp_code: string
          phone_number: string
          user_id: string | null
          verified: boolean
        }
        Insert: {
          attempts?: number
          created_at?: string
          expires_at?: string
          id?: string
          otp_code: string
          phone_number: string
          user_id?: string | null
          verified?: boolean
        }
        Update: {
          attempts?: number
          created_at?: string
          expires_at?: string
          id?: string
          otp_code?: string
          phone_number?: string
          user_id?: string | null
          verified?: boolean
        }
        Relationships: []
      }
      platform_fee_rules: {
        Row: {
          fee_type: string
          id: string
          label: string
          payment_mode: string
          rate_flat: number
          rate_percent: number
          shipping_mode: string
        }
        Insert: {
          fee_type: string
          id: string
          label: string
          payment_mode: string
          rate_flat?: number
          rate_percent?: number
          shipping_mode: string
        }
        Update: {
          fee_type?: string
          id?: string
          label?: string
          payment_mode?: string
          rate_flat?: number
          rate_percent?: number
          shipping_mode?: string
        }
        Relationships: []
      }
      platform_payment_providers: {
        Row: {
          is_active: boolean
          provider: string
          updated_at: string
        }
        Insert: {
          is_active?: boolean
          provider: string
          updated_at?: string
        }
        Update: {
          is_active?: boolean
          provider?: string
          updated_at?: string
        }
        Relationships: []
      }
      poll_options: {
        Row: {
          created_at: string | null
          id: string
          option_text: string
          poll_id: string
          position: number
          vote_count: number | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          option_text: string
          poll_id: string
          position: number
          vote_count?: number | null
        }
        Update: {
          created_at?: string | null
          id?: string
          option_text?: string
          poll_id?: string
          position?: number
          vote_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "poll_options_poll_id_fkey"
            columns: ["poll_id"]
            isOneToOne: false
            referencedRelation: "polls"
            referencedColumns: ["id"]
          },
        ]
      }
      poll_votes: {
        Row: {
          created_at: string | null
          id: string
          option_id: string
          poll_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          option_id: string
          poll_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          option_id?: string
          poll_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_user"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "poll_votes_option_id_fkey"
            columns: ["option_id"]
            isOneToOne: false
            referencedRelation: "poll_options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "poll_votes_poll_id_fkey"
            columns: ["poll_id"]
            isOneToOne: false
            referencedRelation: "polls"
            referencedColumns: ["id"]
          },
        ]
      }
      polls: {
        Row: {
          created_at: string | null
          duration: string
          expires_at: string
          id: string
          is_active: boolean | null
          post_id: string
          question: string
          total_votes: number | null
        }
        Insert: {
          created_at?: string | null
          duration: string
          expires_at: string
          id?: string
          is_active?: boolean | null
          post_id: string
          question: string
          total_votes?: number | null
        }
        Update: {
          created_at?: string | null
          duration?: string
          expires_at?: string
          id?: string
          is_active?: boolean | null
          post_id?: string
          question?: string
          total_votes?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "polls_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: true
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "polls_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: true
            referencedRelation: "posts_with_stats"
            referencedColumns: ["id"]
          },
        ]
      }
      post_analytics: {
        Row: {
          comments: number | null
          created_at: string | null
          id: string
          impressions: number | null
          post_id: string | null
          reactions: number | null
          reposts: number | null
          updated_at: string | null
        }
        Insert: {
          comments?: number | null
          created_at?: string | null
          id?: string
          impressions?: number | null
          post_id?: string | null
          reactions?: number | null
          reposts?: number | null
          updated_at?: string | null
        }
        Update: {
          comments?: number | null
          created_at?: string | null
          id?: string
          impressions?: number | null
          post_id?: string | null
          reactions?: number | null
          reposts?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "post_analytics_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_analytics_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts_with_stats"
            referencedColumns: ["id"]
          },
        ]
      }
      post_event_rsvps: {
        Row: {
          created_at: string
          id: string
          post_id: string
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          status: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_event_rsvps_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_event_rsvps_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts_with_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_event_rsvps_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      post_feedback: {
        Row: {
          created_at: string | null
          id: string
          post_id: string
          reasons: string[]
        }
        Insert: {
          created_at?: string | null
          id?: string
          post_id: string
          reasons: string[]
        }
        Update: {
          created_at?: string | null
          id?: string
          post_id?: string
          reasons?: string[]
        }
        Relationships: []
      }
      post_hashtags: {
        Row: {
          created_at: string | null
          hashtag_id: string
          id: string
          post_id: string
        }
        Insert: {
          created_at?: string | null
          hashtag_id: string
          id?: string
          post_id: string
        }
        Update: {
          created_at?: string | null
          hashtag_id?: string
          id?: string
          post_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_hashtags_hashtag_id_fkey"
            columns: ["hashtag_id"]
            isOneToOne: false
            referencedRelation: "hashtags"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_hashtags_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_hashtags_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts_with_stats"
            referencedColumns: ["id"]
          },
        ]
      }
      post_impressions: {
        Row: {
          id: string
          post_id: string
          view_date: string
          view_duration_seconds: number | null
          viewed_at: string
          viewer_ip: string | null
          viewer_user_agent: string | null
          viewer_user_id: string | null
        }
        Insert: {
          id?: string
          post_id: string
          view_date?: string
          view_duration_seconds?: number | null
          viewed_at?: string
          viewer_ip?: string | null
          viewer_user_agent?: string | null
          viewer_user_id?: string | null
        }
        Update: {
          id?: string
          post_id?: string
          view_date?: string
          view_duration_seconds?: number | null
          viewed_at?: string
          viewer_ip?: string | null
          viewer_user_agent?: string | null
          viewer_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "post_impressions_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_impressions_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts_with_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_impressions_viewer_user_id_fkey"
            columns: ["viewer_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      post_poll_votes: {
        Row: {
          created_at: string
          id: string
          option_index: number
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          option_index: number
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          option_index?: number
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_poll_votes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_poll_votes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts_with_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_poll_votes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      post_reactions: {
        Row: {
          created_at: string | null
          id: string
          post_id: string
          raw_db_post_like: Json | null
          reaction_type: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          post_id: string
          raw_db_post_like?: Json | null
          reaction_type: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          post_id?: string
          raw_db_post_like?: Json | null
          reaction_type?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_reactions_user_id_profiles_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      post_reports: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          post_id: string
          reason: string
          reporter_id: string
          status: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          post_id: string
          reason: string
          reporter_id: string
          status?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          post_id?: string
          reason?: string
          reporter_id?: string
          status?: string | null
        }
        Relationships: []
      }
      post_views: {
        Row: {
          created_at: string | null
          device_type: string | null
          id: string
          ip_address: unknown
          is_unique_view: boolean | null
          post_id: string
          referrer: string | null
          user_agent: string | null
          user_id: string | null
          view_duration: number | null
          viewed_at: string | null
        }
        Insert: {
          created_at?: string | null
          device_type?: string | null
          id?: string
          ip_address?: unknown
          is_unique_view?: boolean | null
          post_id: string
          referrer?: string | null
          user_agent?: string | null
          user_id?: string | null
          view_duration?: number | null
          viewed_at?: string | null
        }
        Update: {
          created_at?: string | null
          device_type?: string | null
          id?: string
          ip_address?: unknown
          is_unique_view?: boolean | null
          post_id?: string
          referrer?: string | null
          user_agent?: string | null
          user_id?: string | null
          view_duration?: number | null
          viewed_at?: string | null
        }
        Relationships: []
      }
      posts: {
        Row: {
          allow_comments: boolean | null
          allow_reactions: boolean | null
          audio_tracks: Json | null
          celebration_data: Json | null
          company_id: string | null
          content: string
          content_warning: string | null
          created_at: string | null
          engagement_score: number | null
          event_description: string | null
          event_end_time: string | null
          event_location: string | null
          event_rsvp_enabled: boolean | null
          event_start_time: string | null
          event_title: string | null
          group_id: string | null
          id: string
          image_url: string | null
          image_urls: string[] | null
          is_deleted: boolean | null
          is_pinned: boolean | null
          language: string | null
          link_preview_data: Json | null
          listing_id: string | null
          media_urls: string[] | null
          mentions: string[] | null
          metadata: Json | null
          original_post_id: string | null
          post_data: Json
          post_type: string | null
          product_data: Json | null
          published_at: string | null
          raw_api_post: Json | null
          repost_comment: string | null
          repost_count: number | null
          scheduled_at: string | null
          service_data: Json | null
          tags: string[] | null
          updated_at: string | null
          user_id: string | null
          video_url: string | null
          video_urls: string[] | null
          visibility: string | null
        }
        Insert: {
          allow_comments?: boolean | null
          allow_reactions?: boolean | null
          audio_tracks?: Json | null
          celebration_data?: Json | null
          company_id?: string | null
          content: string
          content_warning?: string | null
          created_at?: string | null
          engagement_score?: number | null
          event_description?: string | null
          event_end_time?: string | null
          event_location?: string | null
          event_rsvp_enabled?: boolean | null
          event_start_time?: string | null
          event_title?: string | null
          group_id?: string | null
          id?: string
          image_url?: string | null
          image_urls?: string[] | null
          is_deleted?: boolean | null
          is_pinned?: boolean | null
          language?: string | null
          link_preview_data?: Json | null
          listing_id?: string | null
          media_urls?: string[] | null
          mentions?: string[] | null
          metadata?: Json | null
          original_post_id?: string | null
          post_data?: Json
          post_type?: string | null
          product_data?: Json | null
          published_at?: string | null
          raw_api_post?: Json | null
          repost_comment?: string | null
          repost_count?: number | null
          scheduled_at?: string | null
          service_data?: Json | null
          tags?: string[] | null
          updated_at?: string | null
          user_id?: string | null
          video_url?: string | null
          video_urls?: string[] | null
          visibility?: string | null
        }
        Update: {
          allow_comments?: boolean | null
          allow_reactions?: boolean | null
          audio_tracks?: Json | null
          celebration_data?: Json | null
          company_id?: string | null
          content?: string
          content_warning?: string | null
          created_at?: string | null
          engagement_score?: number | null
          event_description?: string | null
          event_end_time?: string | null
          event_location?: string | null
          event_rsvp_enabled?: boolean | null
          event_start_time?: string | null
          event_title?: string | null
          group_id?: string | null
          id?: string
          image_url?: string | null
          image_urls?: string[] | null
          is_deleted?: boolean | null
          is_pinned?: boolean | null
          language?: string | null
          link_preview_data?: Json | null
          listing_id?: string | null
          media_urls?: string[] | null
          mentions?: string[] | null
          metadata?: Json | null
          original_post_id?: string | null
          post_data?: Json
          post_type?: string | null
          product_data?: Json | null
          published_at?: string | null
          raw_api_post?: Json | null
          repost_comment?: string | null
          repost_count?: number | null
          scheduled_at?: string | null
          service_data?: Json | null
          tags?: string[] | null
          updated_at?: string | null
          user_id?: string | null
          video_url?: string | null
          video_urls?: string[] | null
          visibility?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "posts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companypages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posts_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posts_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "active_listings_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posts_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "active_listings_with_shop"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posts_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listing_details_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posts_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posts_original_post_id_fkey"
            columns: ["original_post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posts_original_post_id_fkey"
            columns: ["original_post_id"]
            isOneToOne: false
            referencedRelation: "posts_with_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posts_user_id_fkey_profile"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      product_inquiries: {
        Row: {
          contact_info: Json | null
          created_at: string
          id: string
          message: string | null
          post_id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          contact_info?: Json | null
          created_at?: string
          id?: string
          message?: string | null
          post_id: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          contact_info?: Json | null
          created_at?: string
          id?: string
          message?: string | null
          post_id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_inquiries_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_inquiries_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts_with_stats"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_status_log: {
        Row: {
          changed_by: string | null
          created_at: string
          id: string
          new_status: string
          old_status: string | null
          profile_id: string
          reason: string | null
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          id?: string
          new_status: string
          old_status?: string | null
          profile_id: string
          reason?: string | null
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          id?: string
          new_status?: string
          old_status?: string | null
          profile_id?: string
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profile_status_log_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_view_details: {
        Row: {
          id: string
          is_anonymous: boolean | null
          profile_user_id: string
          viewed_at: string
          viewer_user_id: string | null
        }
        Insert: {
          id?: string
          is_anonymous?: boolean | null
          profile_user_id: string
          viewed_at?: string
          viewer_user_id?: string | null
        }
        Update: {
          id?: string
          is_anonymous?: boolean | null
          profile_user_id?: string
          viewed_at?: string
          viewer_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profile_view_details_profile_user_id_fkey"
            columns: ["profile_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_view_details_viewer_user_id_fkey"
            columns: ["viewer_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_view_notify_log: {
        Row: {
          created_at: string
          profile_user_id: string
          view_date: string
          viewer_user_id: string
        }
        Insert: {
          created_at?: string
          profile_user_id: string
          view_date?: string
          viewer_user_id: string
        }
        Update: {
          created_at?: string
          profile_user_id?: string
          view_date?: string
          viewer_user_id?: string
        }
        Relationships: []
      }
      profile_views: {
        Row: {
          id: string
          profile_user_id: string
          view_date: string
          viewed_at: string
          viewer_ip: string | null
          viewer_user_agent: string | null
          viewer_user_id: string | null
        }
        Insert: {
          id?: string
          profile_user_id: string
          view_date?: string
          viewed_at?: string
          viewer_ip?: string | null
          viewer_user_agent?: string | null
          viewer_user_id?: string | null
        }
        Update: {
          id?: string
          profile_user_id?: string
          view_date?: string
          viewed_at?: string
          viewer_ip?: string | null
          viewer_user_agent?: string | null
          viewer_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profile_views_profile_user_id_fkey"
            columns: ["profile_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_views_viewer_user_id_fkey"
            columns: ["viewer_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          account_status: string
          avatar_url: string | null
          ban_reason: string | null
          bio: string | null
          business_name: string | null
          checkout_phone: string | null
          checkout_phone_verified_at: string | null
          connections_count: number | null
          country_code: string | null
          cover_url: string | null
          created_at: string
          date_of_birth: string | null
          deleted_at: string | null
          device_info: Json
          email: string | null
          email_verified: boolean
          facebook_url: string | null
          fbclid: string | null
          follower_count: number | null
          following_companies: string[] | null
          following_count: number | null
          full_name: string | null
          gender: boolean
          gender_verification_method: string | null
          gender_verified_at: string | null
          github_url: string | null
          headline: string | null
          id: string
          industry: string | null
          instagram_url: string | null
          interests: string[] | null
          is_active: boolean
          is_banned: boolean | null
          is_deleted: boolean | null
          is_online: boolean | null
          is_verified: boolean
          job_preferences: Json | null
          last_login_ip: string | null
          last_login_location: Json
          last_seen: string | null
          last_verification_attempt: string | null
          linkedin_url: string | null
          location: string | null
          login_count: number
          marriage_anniversary: string | null
          member_intents: string[]
          notification_preferences: Json
          occupation: string | null
          onboarding_completed_at: string | null
          phone: string | null
          phone_verified: boolean
          portfolio_url: string | null
          preferred_currency: string
          preferred_language: string
          privacy_settings: Json
          profile_completion_percentage: number
          profile_last_updated: string | null
          push_token: string | null
          referral_code: string | null
          referred_by: string | null
          role: string
          search_tokens: unknown
          search_vector: unknown
          social_links: Json
          timezone: string | null
          twitter_url: string | null
          updated_at: string
          username: string
          utm_campaign: string | null
          utm_content: string | null
          utm_id: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
          verification_attempts: number
          website_url: string | null
          youtube_url: string | null
        }
        Insert: {
          account_status?: string
          avatar_url?: string | null
          ban_reason?: string | null
          bio?: string | null
          business_name?: string | null
          checkout_phone?: string | null
          checkout_phone_verified_at?: string | null
          connections_count?: number | null
          country_code?: string | null
          cover_url?: string | null
          created_at?: string
          date_of_birth?: string | null
          deleted_at?: string | null
          device_info?: Json
          email?: string | null
          email_verified?: boolean
          facebook_url?: string | null
          fbclid?: string | null
          follower_count?: number | null
          following_companies?: string[] | null
          following_count?: number | null
          full_name?: string | null
          gender?: boolean
          gender_verification_method?: string | null
          gender_verified_at?: string | null
          github_url?: string | null
          headline?: string | null
          id: string
          industry?: string | null
          instagram_url?: string | null
          interests?: string[] | null
          is_active?: boolean
          is_banned?: boolean | null
          is_deleted?: boolean | null
          is_online?: boolean | null
          is_verified?: boolean
          job_preferences?: Json | null
          last_login_ip?: string | null
          last_login_location?: Json
          last_seen?: string | null
          last_verification_attempt?: string | null
          linkedin_url?: string | null
          location?: string | null
          login_count?: number
          marriage_anniversary?: string | null
          member_intents?: string[]
          notification_preferences?: Json
          occupation?: string | null
          onboarding_completed_at?: string | null
          phone?: string | null
          phone_verified?: boolean
          portfolio_url?: string | null
          preferred_currency?: string
          preferred_language?: string
          privacy_settings?: Json
          profile_completion_percentage?: number
          profile_last_updated?: string | null
          push_token?: string | null
          referral_code?: string | null
          referred_by?: string | null
          role?: string
          search_tokens?: unknown
          search_vector?: unknown
          social_links?: Json
          timezone?: string | null
          twitter_url?: string | null
          updated_at?: string
          username: string
          utm_campaign?: string | null
          utm_content?: string | null
          utm_id?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          verification_attempts?: number
          website_url?: string | null
          youtube_url?: string | null
        }
        Update: {
          account_status?: string
          avatar_url?: string | null
          ban_reason?: string | null
          bio?: string | null
          business_name?: string | null
          checkout_phone?: string | null
          checkout_phone_verified_at?: string | null
          connections_count?: number | null
          country_code?: string | null
          cover_url?: string | null
          created_at?: string
          date_of_birth?: string | null
          deleted_at?: string | null
          device_info?: Json
          email?: string | null
          email_verified?: boolean
          facebook_url?: string | null
          fbclid?: string | null
          follower_count?: number | null
          following_companies?: string[] | null
          following_count?: number | null
          full_name?: string | null
          gender?: boolean
          gender_verification_method?: string | null
          gender_verified_at?: string | null
          github_url?: string | null
          headline?: string | null
          id?: string
          industry?: string | null
          instagram_url?: string | null
          interests?: string[] | null
          is_active?: boolean
          is_banned?: boolean | null
          is_deleted?: boolean | null
          is_online?: boolean | null
          is_verified?: boolean
          job_preferences?: Json | null
          last_login_ip?: string | null
          last_login_location?: Json
          last_seen?: string | null
          last_verification_attempt?: string | null
          linkedin_url?: string | null
          location?: string | null
          login_count?: number
          marriage_anniversary?: string | null
          member_intents?: string[]
          notification_preferences?: Json
          occupation?: string | null
          onboarding_completed_at?: string | null
          phone?: string | null
          phone_verified?: boolean
          portfolio_url?: string | null
          preferred_currency?: string
          preferred_language?: string
          privacy_settings?: Json
          profile_completion_percentage?: number
          profile_last_updated?: string | null
          push_token?: string | null
          referral_code?: string | null
          referred_by?: string | null
          role?: string
          search_tokens?: unknown
          search_vector?: unknown
          social_links?: Json
          timezone?: string | null
          twitter_url?: string | null
          updated_at?: string
          username?: string
          utm_campaign?: string | null
          utm_content?: string | null
          utm_id?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          verification_attempts?: number
          website_url?: string | null
          youtube_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_referred_by_fkey"
            columns: ["referred_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      program_author_subscriptions: {
        Row: {
          author_id: string
          created_at: string
          subscriber_id: string
        }
        Insert: {
          author_id: string
          created_at?: string
          subscriber_id: string
        }
        Update: {
          author_id?: string
          created_at?: string
          subscriber_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "program_author_subscriptions_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      program_categories: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          moderated_at: string | null
          moderated_by: string | null
          name: string
          rejection_reason: string | null
          status: string | null
          suggested_by: string | null
          thumbnail_url: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          moderated_at?: string | null
          moderated_by?: string | null
          name: string
          rejection_reason?: string | null
          status?: string | null
          suggested_by?: string | null
          thumbnail_url?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          moderated_at?: string | null
          moderated_by?: string | null
          name?: string
          rejection_reason?: string | null
          status?: string | null
          suggested_by?: string | null
          thumbnail_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "program_categories_moderated_by_fkey"
            columns: ["moderated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "program_categories_suggested_by_fkey"
            columns: ["suggested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      program_comments: {
        Row: {
          comment_text: string
          created_at: string
          deleted_at: string | null
          edited_at: string | null
          id: string
          is_edited: boolean
          parent_id: string | null
          program_id: string
          user_id: string
        }
        Insert: {
          comment_text: string
          created_at?: string
          deleted_at?: string | null
          edited_at?: string | null
          id?: string
          is_edited?: boolean
          parent_id?: string | null
          program_id: string
          user_id: string
        }
        Update: {
          comment_text?: string
          created_at?: string
          deleted_at?: string | null
          edited_at?: string | null
          id?: string
          is_edited?: boolean
          parent_id?: string | null
          program_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "program_comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "program_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "program_comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "program_comments_with_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "program_comments_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "program_reactions_summary"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "program_comments_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "program_comments_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs_seo_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "program_comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      program_likes: {
        Row: {
          created_at: string
          program_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          program_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          program_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "program_likes_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "program_reactions_summary"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "program_likes_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "program_likes_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs_seo_view"
            referencedColumns: ["id"]
          },
        ]
      }
      program_playlist_items: {
        Row: {
          created_at: string
          playlist_id: string
          program_id: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          playlist_id: string
          program_id: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          playlist_id?: string
          program_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "program_playlist_items_playlist_id_fkey"
            columns: ["playlist_id"]
            isOneToOne: false
            referencedRelation: "program_playlists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "program_playlist_items_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "program_reactions_summary"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "program_playlist_items_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "program_playlist_items_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs_seo_view"
            referencedColumns: ["id"]
          },
        ]
      }
      program_playlists: {
        Row: {
          created_at: string
          id: string
          media_type: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          media_type: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          media_type?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      program_plays: {
        Row: {
          created_at: string
          id: string
          play_type: string
          program_id: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          play_type: string
          program_id: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          play_type?: string
          program_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "program_plays_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "program_reactions_summary"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "program_plays_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "program_plays_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs_seo_view"
            referencedColumns: ["id"]
          },
        ]
      }
      program_reactions: {
        Row: {
          context_id: string
          context_type: string
          created_at: string
          id: string
          reaction_type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          context_id: string
          context_type: string
          created_at?: string
          id?: string
          reaction_type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          context_id?: string
          context_type?: string
          created_at?: string
          id?: string
          reaction_type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "program_reactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      program_stats: {
        Row: {
          created_at: string | null
          id: string
          play_count: number | null
          program_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          play_count?: number | null
          program_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          play_count?: number | null
          program_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "program_stats_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "program_reactions_summary"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "program_stats_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "program_stats_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs_seo_view"
            referencedColumns: ["id"]
          },
        ]
      }
      programs: {
        Row: {
          audio_url: string | null
          author_id: string | null
          canonical_url: string | null
          category: string
          created_at: string | null
          description: string
          duration: string
          external_author_id: string | null
          featured: boolean
          id: string
          image_url: string | null
          language: string
          like_count: number | null
          listen_count: number
          media_type: string
          meta_description: string | null
          meta_title: string | null
          open_graph_description: string | null
          open_graph_image: string | null
          open_graph_title: string | null
          published_at: string | null
          robots_follow: boolean | null
          robots_index: boolean | null
          seo_description: string | null
          seo_keywords: string[] | null
          seo_priority: number | null
          seo_slug: string | null
          seo_title: string | null
          tags: string[] | null
          title: string
          twitter_card_type: string | null
          twitter_description: string | null
          twitter_image: string | null
          twitter_title: string | null
          updated_at: string | null
          video_url: string | null
          view_count: number | null
        }
        Insert: {
          audio_url?: string | null
          author_id?: string | null
          canonical_url?: string | null
          category: string
          created_at?: string | null
          description: string
          duration: string
          external_author_id?: string | null
          featured?: boolean
          id?: string
          image_url?: string | null
          language?: string
          like_count?: number | null
          listen_count?: number
          media_type?: string
          meta_description?: string | null
          meta_title?: string | null
          open_graph_description?: string | null
          open_graph_image?: string | null
          open_graph_title?: string | null
          published_at?: string | null
          robots_follow?: boolean | null
          robots_index?: boolean | null
          seo_description?: string | null
          seo_keywords?: string[] | null
          seo_priority?: number | null
          seo_slug?: string | null
          seo_title?: string | null
          tags?: string[] | null
          title: string
          twitter_card_type?: string | null
          twitter_description?: string | null
          twitter_image?: string | null
          twitter_title?: string | null
          updated_at?: string | null
          video_url?: string | null
          view_count?: number | null
        }
        Update: {
          audio_url?: string | null
          author_id?: string | null
          canonical_url?: string | null
          category?: string
          created_at?: string | null
          description?: string
          duration?: string
          external_author_id?: string | null
          featured?: boolean
          id?: string
          image_url?: string | null
          language?: string
          like_count?: number | null
          listen_count?: number
          media_type?: string
          meta_description?: string | null
          meta_title?: string | null
          open_graph_description?: string | null
          open_graph_image?: string | null
          open_graph_title?: string | null
          published_at?: string | null
          robots_follow?: boolean | null
          robots_index?: boolean | null
          seo_description?: string | null
          seo_keywords?: string[] | null
          seo_priority?: number | null
          seo_slug?: string | null
          seo_title?: string | null
          tags?: string[] | null
          title?: string
          twitter_card_type?: string | null
          twitter_description?: string | null
          twitter_image?: string | null
          twitter_title?: string | null
          updated_at?: string | null
          video_url?: string | null
          view_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "programs_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      promotional_media: {
        Row: {
          aspect_ratio: string | null
          click_count: number | null
          conversion_count: number | null
          created_at: string | null
          display_order: number | null
          duration_seconds: number | null
          file_name: string | null
          file_size_mb: number | null
          id: string
          is_active: boolean | null
          is_featured: boolean | null
          last_viewed_at: string | null
          listing_id: string | null
          media_type: string
          popularity_score: number | null
          resolution: string | null
          shop_id: string
          storage_path: string | null
          thumbnail_url: string | null
          updated_at: string | null
          uploaded_by: string | null
          video_description: string | null
          video_format: string | null
          video_source: string | null
          video_title: string | null
          video_url: string
          view_count: number | null
        }
        Insert: {
          aspect_ratio?: string | null
          click_count?: number | null
          conversion_count?: number | null
          created_at?: string | null
          display_order?: number | null
          duration_seconds?: number | null
          file_name?: string | null
          file_size_mb?: number | null
          id?: string
          is_active?: boolean | null
          is_featured?: boolean | null
          last_viewed_at?: string | null
          listing_id?: string | null
          media_type: string
          popularity_score?: number | null
          resolution?: string | null
          shop_id: string
          storage_path?: string | null
          thumbnail_url?: string | null
          updated_at?: string | null
          uploaded_by?: string | null
          video_description?: string | null
          video_format?: string | null
          video_source?: string | null
          video_title?: string | null
          video_url: string
          view_count?: number | null
        }
        Update: {
          aspect_ratio?: string | null
          click_count?: number | null
          conversion_count?: number | null
          created_at?: string | null
          display_order?: number | null
          duration_seconds?: number | null
          file_name?: string | null
          file_size_mb?: number | null
          id?: string
          is_active?: boolean | null
          is_featured?: boolean | null
          last_viewed_at?: string | null
          listing_id?: string | null
          media_type?: string
          popularity_score?: number | null
          resolution?: string | null
          shop_id?: string
          storage_path?: string | null
          thumbnail_url?: string | null
          updated_at?: string | null
          uploaded_by?: string | null
          video_description?: string | null
          video_format?: string | null
          video_source?: string | null
          video_title?: string | null
          video_url?: string
          view_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "promotional_media_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "active_listings_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promotional_media_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "active_listings_with_shop"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promotional_media_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listing_details_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promotional_media_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promotional_media_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "active_listings_view"
            referencedColumns: ["shop_id"]
          },
          {
            foreignKeyName: "promotional_media_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "payment_analytics"
            referencedColumns: ["shop_id"]
          },
          {
            foreignKeyName: "promotional_media_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shop_listings_summary"
            referencedColumns: ["shop_id"]
          },
          {
            foreignKeyName: "promotional_media_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promotional_media_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      recommendation_notification_log: {
        Row: {
          channels: string[]
          guest_session_id: string | null
          id: string
          listing_ids: string[]
          metadata: Json | null
          sent_at: string
          user_id: string | null
        }
        Insert: {
          channels?: string[]
          guest_session_id?: string | null
          id?: string
          listing_ids?: string[]
          metadata?: Json | null
          sent_at?: string
          user_id?: string | null
        }
        Update: {
          channels?: string[]
          guest_session_id?: string | null
          id?: string
          listing_ids?: string[]
          metadata?: Json | null
          sent_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      recommendation_requests: {
        Row: {
          created_at: string | null
          id: string
          message: string | null
          requested_from_id: string
          requester_id: string
          status: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          message?: string | null
          requested_from_id: string
          requester_id: string
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          message?: string | null
          requested_from_id?: string
          requester_id?: string
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "recommendation_requests_requested_from_id_fkey"
            columns: ["requested_from_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recommendation_requests_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      recommendations: {
        Row: {
          created_at: string | null
          id: string
          recommendation_text: string
          recommended_user_id: string
          recommender_id: string
          status: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          recommendation_text: string
          recommended_user_id: string
          recommender_id: string
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          recommendation_text?: string
          recommended_user_id?: string
          recommender_id?: string
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "recommendations_recommended_user_id_fkey"
            columns: ["recommended_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recommendations_recommender_id_fkey"
            columns: ["recommender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      refunds: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          completed_at: string | null
          created_at: string
          detailed_reason: string | null
          gateway_refund_request_id: string | null
          gateway_refund_status: string | null
          id: string
          initiated_by: string
          item_refund_amount: number
          order_item_id: string
          processed_at: string | null
          refund_amount: number
          refund_kind: string
          refund_method: string | null
          refund_reason: string
          refund_status: Database["public"]["Enums"]["refund_status_enum"]
          refund_transaction_id: string | null
          restocking_fee: number | null
          return_received_at: string | null
          return_shipped_at: string | null
          return_tracking_number: string | null
          shipping_fee_deducted: number | null
          shipping_fee_refunded: number | null
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          completed_at?: string | null
          created_at?: string
          detailed_reason?: string | null
          gateway_refund_request_id?: string | null
          gateway_refund_status?: string | null
          id?: string
          initiated_by: string
          item_refund_amount: number
          order_item_id: string
          processed_at?: string | null
          refund_amount: number
          refund_kind?: string
          refund_method?: string | null
          refund_reason: string
          refund_status?: Database["public"]["Enums"]["refund_status_enum"]
          refund_transaction_id?: string | null
          restocking_fee?: number | null
          return_received_at?: string | null
          return_shipped_at?: string | null
          return_tracking_number?: string | null
          shipping_fee_deducted?: number | null
          shipping_fee_refunded?: number | null
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          completed_at?: string | null
          created_at?: string
          detailed_reason?: string | null
          gateway_refund_request_id?: string | null
          gateway_refund_status?: string | null
          id?: string
          initiated_by?: string
          item_refund_amount?: number
          order_item_id?: string
          processed_at?: string | null
          refund_amount?: number
          refund_kind?: string
          refund_method?: string | null
          refund_reason?: string
          refund_status?: Database["public"]["Enums"]["refund_status_enum"]
          refund_transaction_id?: string | null
          restocking_fee?: number | null
          return_received_at?: string | null
          return_shipped_at?: string | null
          return_tracking_number?: string | null
          shipping_fee_deducted?: number | null
          shipping_fee_refunded?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "refunds_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          company_id: string
          created_at: string | null
          id: number
          reason: string
        }
        Insert: {
          company_id: string
          created_at?: string | null
          id?: number
          reason: string
        }
        Update: {
          company_id?: string
          created_at?: string | null
          id?: number
          reason?: string
        }
        Relationships: []
      }
      repost_details: {
        Row: {
          created_at: string | null
          id: string
          original_post_id: string
          raw_api_repost: Json | null
          repost_comment: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          original_post_id: string
          raw_api_repost?: Json | null
          repost_comment?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          original_post_id?: string
          raw_api_repost?: Json | null
          repost_comment?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "repost_details_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reposts: {
        Row: {
          comment: string | null
          created_at: string | null
          id: string
          post_id: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          comment?: string | null
          created_at?: string | null
          id?: string
          post_id?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          comment?: string | null
          created_at?: string | null
          id?: string
          post_id?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reposts_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reposts_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts_with_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reposts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      return_policies: {
        Row: {
          accepts_exchanges: boolean
          accepts_refunds: boolean
          accepts_returns: boolean
          condition_description: string | null
          created_at: string
          id: string
          is_active: boolean
          is_default: boolean
          policy_details: string | null
          policy_name: string
          return_shipping_paid_by: string | null
          return_window_days: number
          shop_id: string
          updated_at: string
        }
        Insert: {
          accepts_exchanges?: boolean
          accepts_refunds?: boolean
          accepts_returns?: boolean
          condition_description?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          is_default?: boolean
          policy_details?: string | null
          policy_name: string
          return_shipping_paid_by?: string | null
          return_window_days: number
          shop_id: string
          updated_at?: string
        }
        Update: {
          accepts_exchanges?: boolean
          accepts_refunds?: boolean
          accepts_returns?: boolean
          condition_description?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          is_default?: boolean
          policy_details?: string | null
          policy_name?: string
          return_shipping_paid_by?: string | null
          return_window_days?: number
          shop_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "return_policies_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "active_listings_view"
            referencedColumns: ["shop_id"]
          },
          {
            foreignKeyName: "return_policies_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "payment_analytics"
            referencedColumns: ["shop_id"]
          },
          {
            foreignKeyName: "return_policies_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shop_listings_summary"
            referencedColumns: ["shop_id"]
          },
          {
            foreignKeyName: "return_policies_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      sale_events: {
        Row: {
          banner_image: string | null
          created_at: string
          created_by: string | null
          currency: string
          description: string | null
          end_date: string
          event_name: string
          event_slug: string
          id: string
          registration_end_date: string | null
          registration_start_date: string | null
          start_date: string
          status: string
          updated_at: string
        }
        Insert: {
          banner_image?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string | null
          end_date: string
          event_name: string
          event_slug: string
          id?: string
          registration_end_date?: string | null
          registration_start_date?: string | null
          start_date: string
          status?: string
          updated_at?: string
        }
        Update: {
          banner_image?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string | null
          end_date?: string
          event_name?: string
          event_slug?: string
          id?: string
          registration_end_date?: string | null
          registration_start_date?: string | null
          start_date?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      sales_analytics: {
        Row: {
          created_at: string
          currency: string
          customer_id: string | null
          delivered_at: string
          delivery_country: string | null
          delivery_mode: string | null
          delivery_region: string | null
          delivery_status: Database["public"]["Enums"]["delivery_status_enum"]
          id: string
          is_refunded: boolean
          is_returned: boolean
          item_discount_amount: number | null
          listing_id: string
          order_discount_amount: number | null
          order_id: string | null
          order_item_id: string
          order_number: string
          order_shipping_amount: number | null
          order_subtotal_amount: number
          order_tax_amount: number | null
          order_total_amount: number
          ordered_at: string
          payment_mode: Database["public"]["Enums"]["payment_mode_enum"]
          payment_status: Database["public"]["Enums"]["payment_status_enum"]
          product_category: string | null
          product_sku: string | null
          product_title: string
          quantity: number
          refund_amount: number | null
          refund_status:
            | Database["public"]["Enums"]["refund_status_enum"]
            | null
          refunded_at: string | null
          return_reason: string | null
          returned_at: string | null
          sale_status: string | null
          shop_id: string
          total_item_price: number
          total_revenue: number
          unit_price: number
          updated_at: string
          variation_details: Json | null
        }
        Insert: {
          created_at?: string
          currency?: string
          customer_id?: string | null
          delivered_at: string
          delivery_country?: string | null
          delivery_mode?: string | null
          delivery_region?: string | null
          delivery_status: Database["public"]["Enums"]["delivery_status_enum"]
          id?: string
          is_refunded?: boolean
          is_returned?: boolean
          item_discount_amount?: number | null
          listing_id: string
          order_discount_amount?: number | null
          order_id?: string | null
          order_item_id: string
          order_number: string
          order_shipping_amount?: number | null
          order_subtotal_amount: number
          order_tax_amount?: number | null
          order_total_amount: number
          ordered_at: string
          payment_mode: Database["public"]["Enums"]["payment_mode_enum"]
          payment_status: Database["public"]["Enums"]["payment_status_enum"]
          product_category?: string | null
          product_sku?: string | null
          product_title: string
          quantity: number
          refund_amount?: number | null
          refund_status?:
            | Database["public"]["Enums"]["refund_status_enum"]
            | null
          refunded_at?: string | null
          return_reason?: string | null
          returned_at?: string | null
          sale_status?: string | null
          shop_id: string
          total_item_price: number
          total_revenue: number
          unit_price: number
          updated_at?: string
          variation_details?: Json | null
        }
        Update: {
          created_at?: string
          currency?: string
          customer_id?: string | null
          delivered_at?: string
          delivery_country?: string | null
          delivery_mode?: string | null
          delivery_region?: string | null
          delivery_status?: Database["public"]["Enums"]["delivery_status_enum"]
          id?: string
          is_refunded?: boolean
          is_returned?: boolean
          item_discount_amount?: number | null
          listing_id?: string
          order_discount_amount?: number | null
          order_id?: string | null
          order_item_id?: string
          order_number?: string
          order_shipping_amount?: number | null
          order_subtotal_amount?: number
          order_tax_amount?: number | null
          order_total_amount?: number
          ordered_at?: string
          payment_mode?: Database["public"]["Enums"]["payment_mode_enum"]
          payment_status?: Database["public"]["Enums"]["payment_status_enum"]
          product_category?: string | null
          product_sku?: string | null
          product_title?: string
          quantity?: number
          refund_amount?: number | null
          refund_status?:
            | Database["public"]["Enums"]["refund_status_enum"]
            | null
          refunded_at?: string | null
          return_reason?: string | null
          returned_at?: string | null
          sale_status?: string | null
          shop_id?: string
          total_item_price?: number
          total_revenue?: number
          unit_price?: number
          updated_at?: string
          variation_details?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_analytics_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "active_listings_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_analytics_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "active_listings_with_shop"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_analytics_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listing_details_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_analytics_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_analytics_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "customer_order_history_view"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "sales_analytics_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "customer_orders_view"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "sales_analytics_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_analytics_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: true
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_analytics_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "active_listings_view"
            referencedColumns: ["shop_id"]
          },
          {
            foreignKeyName: "sales_analytics_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "payment_analytics"
            referencedColumns: ["shop_id"]
          },
          {
            foreignKeyName: "sales_analytics_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shop_listings_summary"
            referencedColumns: ["shop_id"]
          },
          {
            foreignKeyName: "sales_analytics_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_jobs: {
        Row: {
          created_at: string | null
          id: string
          job_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          job_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          job_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_jobs_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_posts: {
        Row: {
          collection_name: string | null
          created_at: string | null
          id: string
          notes: string | null
          post_id: string
          user_id: string
        }
        Insert: {
          collection_name?: string | null
          created_at?: string | null
          id?: string
          notes?: string | null
          post_id: string
          user_id: string
        }
        Update: {
          collection_name?: string | null
          created_at?: string | null
          id?: string
          notes?: string | null
          post_id?: string
          user_id?: string
        }
        Relationships: []
      }
      saved_replies: {
        Row: {
          content: string
          created_at: string | null
          id: string
          title: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          title: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      service_bookings: {
        Row: {
          contact_info: Json | null
          created_at: string
          id: string
          message: string | null
          post_id: string
          preferred_date: string | null
          preferred_time: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          contact_info?: Json | null
          created_at?: string
          id?: string
          message?: string | null
          post_id: string
          preferred_date?: string | null
          preferred_time?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          contact_info?: Json | null
          created_at?: string
          id?: string
          message?: string | null
          post_id?: string
          preferred_date?: string | null
          preferred_time?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_bookings_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_bookings_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts_with_stats"
            referencedColumns: ["id"]
          },
        ]
      }
      shepay_pending_settlements: {
        Row: {
          amount: number
          checkout_group_id: string | null
          child_merchant_key: string | null
          child_mid: string | null
          created_at: string
          currency: string
          error_message: string | null
          id: string
          payment_step_id: string | null
          payu_id: string
          release_payload: Json | null
          released_at: string | null
          shop_id: string
          status: string
          txnid: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          checkout_group_id?: string | null
          child_merchant_key?: string | null
          child_mid?: string | null
          created_at?: string
          currency?: string
          error_message?: string | null
          id?: string
          payment_step_id?: string | null
          payu_id: string
          release_payload?: Json | null
          released_at?: string | null
          shop_id: string
          status?: string
          txnid?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          checkout_group_id?: string | null
          child_merchant_key?: string | null
          child_mid?: string | null
          created_at?: string
          currency?: string
          error_message?: string | null
          id?: string
          payment_step_id?: string | null
          payu_id?: string
          release_payload?: Json | null
          released_at?: string | null
          shop_id?: string
          status?: string
          txnid?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shepay_pending_settlements_checkout_group_id_fkey"
            columns: ["checkout_group_id"]
            isOneToOne: false
            referencedRelation: "commerce_checkout_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shepay_pending_settlements_payment_step_id_fkey"
            columns: ["payment_step_id"]
            isOneToOne: false
            referencedRelation: "commerce_checkout_payment_steps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shepay_pending_settlements_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "active_listings_view"
            referencedColumns: ["shop_id"]
          },
          {
            foreignKeyName: "shepay_pending_settlements_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "payment_analytics"
            referencedColumns: ["shop_id"]
          },
          {
            foreignKeyName: "shepay_pending_settlements_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shop_listings_summary"
            referencedColumns: ["shop_id"]
          },
          {
            foreignKeyName: "shepay_pending_settlements_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      shipping_providers: {
        Row: {
          configuration: Json | null
          created_at: string | null
          id: string
          is_active: boolean | null
          is_primary: boolean | null
          priority: number | null
          provider_name: string
          provider_type: string
          shop_id: string
          updated_at: string | null
        }
        Insert: {
          configuration?: Json | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          is_primary?: boolean | null
          priority?: number | null
          provider_name: string
          provider_type: string
          shop_id: string
          updated_at?: string | null
        }
        Update: {
          configuration?: Json | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          is_primary?: boolean | null
          priority?: number | null
          provider_name?: string
          provider_type?: string
          shop_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shipping_providers_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "active_listings_view"
            referencedColumns: ["shop_id"]
          },
          {
            foreignKeyName: "shipping_providers_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "payment_analytics"
            referencedColumns: ["shop_id"]
          },
          {
            foreignKeyName: "shipping_providers_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shop_listings_summary"
            referencedColumns: ["shop_id"]
          },
          {
            foreignKeyName: "shipping_providers_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      shipping_rates: {
        Row: {
          base_price: number
          created_at: string | null
          currency: string | null
          delivery_days_max: number | null
          delivery_days_min: number | null
          id: string
          is_active: boolean | null
          max_weight: number | null
          min_weight: number | null
          per_kg_price: number | null
          pincodes: Json | null
          shipping_provider_id: string
          shop_id: string
          states: Json | null
          updated_at: string | null
          zone_name: string
          zone_type: string | null
        }
        Insert: {
          base_price: number
          created_at?: string | null
          currency?: string | null
          delivery_days_max?: number | null
          delivery_days_min?: number | null
          id?: string
          is_active?: boolean | null
          max_weight?: number | null
          min_weight?: number | null
          per_kg_price?: number | null
          pincodes?: Json | null
          shipping_provider_id: string
          shop_id: string
          states?: Json | null
          updated_at?: string | null
          zone_name: string
          zone_type?: string | null
        }
        Update: {
          base_price?: number
          created_at?: string | null
          currency?: string | null
          delivery_days_max?: number | null
          delivery_days_min?: number | null
          id?: string
          is_active?: boolean | null
          max_weight?: number | null
          min_weight?: number | null
          per_kg_price?: number | null
          pincodes?: Json | null
          shipping_provider_id?: string
          shop_id?: string
          states?: Json | null
          updated_at?: string | null
          zone_name?: string
          zone_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shipping_rates_shipping_provider_id_fkey"
            columns: ["shipping_provider_id"]
            isOneToOne: false
            referencedRelation: "shipping_providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipping_rates_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "active_listings_view"
            referencedColumns: ["shop_id"]
          },
          {
            foreignKeyName: "shipping_rates_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "payment_analytics"
            referencedColumns: ["shop_id"]
          },
          {
            foreignKeyName: "shipping_rates_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shop_listings_summary"
            referencedColumns: ["shop_id"]
          },
          {
            foreignKeyName: "shipping_rates_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_commerce_settings: {
        Row: {
          breeze_auth_token: string | null
          breeze_merchant_id: string | null
          breeze_shop_url: string | null
          created_at: string
          payment_account_label: string | null
          payment_connected: boolean
          payment_gateway: string | null
          payment_gateway_key_id: string | null
          payment_mode: string
          shipping_account_label: string | null
          shipping_connected: boolean
          shipping_mode: string
          shipping_partner: string | null
          shop_id: string
          updated_at: string
        }
        Insert: {
          breeze_auth_token?: string | null
          breeze_merchant_id?: string | null
          breeze_shop_url?: string | null
          created_at?: string
          payment_account_label?: string | null
          payment_connected?: boolean
          payment_gateway?: string | null
          payment_gateway_key_id?: string | null
          payment_mode?: string
          shipping_account_label?: string | null
          shipping_connected?: boolean
          shipping_mode?: string
          shipping_partner?: string | null
          shop_id: string
          updated_at?: string
        }
        Update: {
          breeze_auth_token?: string | null
          breeze_merchant_id?: string | null
          breeze_shop_url?: string | null
          created_at?: string
          payment_account_label?: string | null
          payment_connected?: boolean
          payment_gateway?: string | null
          payment_gateway_key_id?: string | null
          payment_mode?: string
          shipping_account_label?: string | null
          shipping_connected?: boolean
          shipping_mode?: string
          shipping_partner?: string | null
          shop_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shop_commerce_settings_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: true
            referencedRelation: "active_listings_view"
            referencedColumns: ["shop_id"]
          },
          {
            foreignKeyName: "shop_commerce_settings_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: true
            referencedRelation: "payment_analytics"
            referencedColumns: ["shop_id"]
          },
          {
            foreignKeyName: "shop_commerce_settings_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: true
            referencedRelation: "shop_listings_summary"
            referencedColumns: ["shop_id"]
          },
          {
            foreignKeyName: "shop_commerce_settings_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: true
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_customer_journey_sends: {
        Row: {
          customer_id: string
          id: string
          journey_id: string
          sent_at: string
          shop_id: string
        }
        Insert: {
          customer_id: string
          id?: string
          journey_id: string
          sent_at?: string
          shop_id: string
        }
        Update: {
          customer_id?: string
          id?: string
          journey_id?: string
          sent_at?: string
          shop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shop_customer_journey_sends_journey_id_fkey"
            columns: ["journey_id"]
            isOneToOne: false
            referencedRelation: "shop_customer_journeys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_customer_journey_sends_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "active_listings_view"
            referencedColumns: ["shop_id"]
          },
          {
            foreignKeyName: "shop_customer_journey_sends_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "payment_analytics"
            referencedColumns: ["shop_id"]
          },
          {
            foreignKeyName: "shop_customer_journey_sends_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shop_listings_summary"
            referencedColumns: ["shop_id"]
          },
          {
            foreignKeyName: "shop_customer_journey_sends_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_customer_journeys: {
        Row: {
          cooldown_days: number
          created_at: string
          id: string
          is_active: boolean
          message: string
          name: string
          segment: string
          shop_id: string
          title: string
          updated_at: string
        }
        Insert: {
          cooldown_days?: number
          created_at?: string
          id?: string
          is_active?: boolean
          message: string
          name: string
          segment: string
          shop_id: string
          title: string
          updated_at?: string
        }
        Update: {
          cooldown_days?: number
          created_at?: string
          id?: string
          is_active?: boolean
          message?: string
          name?: string
          segment?: string
          shop_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shop_customer_journeys_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "active_listings_view"
            referencedColumns: ["shop_id"]
          },
          {
            foreignKeyName: "shop_customer_journeys_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "payment_analytics"
            referencedColumns: ["shop_id"]
          },
          {
            foreignKeyName: "shop_customer_journeys_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shop_listings_summary"
            referencedColumns: ["shop_id"]
          },
          {
            foreignKeyName: "shop_customer_journeys_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_customer_notes: {
        Row: {
          body: string
          created_at: string
          created_by: string | null
          customer_id: string
          id: string
          shop_id: string
        }
        Insert: {
          body: string
          created_at?: string
          created_by?: string | null
          customer_id: string
          id?: string
          shop_id: string
        }
        Update: {
          body?: string
          created_at?: string
          created_by?: string | null
          customer_id?: string
          id?: string
          shop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shop_customer_notes_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "active_listings_view"
            referencedColumns: ["shop_id"]
          },
          {
            foreignKeyName: "shop_customer_notes_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "payment_analytics"
            referencedColumns: ["shop_id"]
          },
          {
            foreignKeyName: "shop_customer_notes_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shop_listings_summary"
            referencedColumns: ["shop_id"]
          },
          {
            foreignKeyName: "shop_customer_notes_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_customer_tags: {
        Row: {
          created_at: string
          created_by: string | null
          customer_id: string
          id: string
          shop_id: string
          tag: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          customer_id: string
          id?: string
          shop_id: string
          tag: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          customer_id?: string
          id?: string
          shop_id?: string
          tag?: string
        }
        Relationships: [
          {
            foreignKeyName: "shop_customer_tags_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "active_listings_view"
            referencedColumns: ["shop_id"]
          },
          {
            foreignKeyName: "shop_customer_tags_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "payment_analytics"
            referencedColumns: ["shop_id"]
          },
          {
            foreignKeyName: "shop_customer_tags_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shop_listings_summary"
            referencedColumns: ["shop_id"]
          },
          {
            foreignKeyName: "shop_customer_tags_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_follows: {
        Row: {
          created_at: string
          id: string
          shop_id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          shop_id: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          shop_id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shop_follows_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "active_listings_view"
            referencedColumns: ["shop_id"]
          },
          {
            foreignKeyName: "shop_follows_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "payment_analytics"
            referencedColumns: ["shop_id"]
          },
          {
            foreignKeyName: "shop_follows_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shop_listings_summary"
            referencedColumns: ["shop_id"]
          },
          {
            foreignKeyName: "shop_follows_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_payu_kyc: {
        Row: {
          admin_note: string | null
          bank_account_number: string
          bank_document_path: string | null
          bank_holder_name: string
          business_entity_id: number
          business_name: string
          created_at: string
          email: string
          gst_document_path: string | null
          gst_legal_name: string | null
          gst_number: string | null
          gst_status: string | null
          gst_trade_name: string | null
          ifsc: string
          legal_name: string
          mobile: string
          monthly_expected_volume: number
          pan_document_path: string | null
          pan_name: string
          pan_number: string
          payu_document_status: string | null
          payu_error: string | null
          payu_kyc_status: string | null
          payu_merchant_key: string | null
          payu_mid: string | null
          payu_onboarding_status: string | null
          payu_product_account_uuid: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          schedule_c_document_path: string | null
          shop_id: string
          status: string
          updated_at: string
        }
        Insert: {
          admin_note?: string | null
          bank_account_number?: string
          bank_document_path?: string | null
          bank_holder_name?: string
          business_entity_id?: number
          business_name?: string
          created_at?: string
          email?: string
          gst_document_path?: string | null
          gst_legal_name?: string | null
          gst_number?: string | null
          gst_status?: string | null
          gst_trade_name?: string | null
          ifsc?: string
          legal_name?: string
          mobile?: string
          monthly_expected_volume?: number
          pan_document_path?: string | null
          pan_name?: string
          pan_number?: string
          payu_document_status?: string | null
          payu_error?: string | null
          payu_kyc_status?: string | null
          payu_merchant_key?: string | null
          payu_mid?: string | null
          payu_onboarding_status?: string | null
          payu_product_account_uuid?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          schedule_c_document_path?: string | null
          shop_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          admin_note?: string | null
          bank_account_number?: string
          bank_document_path?: string | null
          bank_holder_name?: string
          business_entity_id?: number
          business_name?: string
          created_at?: string
          email?: string
          gst_document_path?: string | null
          gst_legal_name?: string | null
          gst_number?: string | null
          gst_status?: string | null
          gst_trade_name?: string | null
          ifsc?: string
          legal_name?: string
          mobile?: string
          monthly_expected_volume?: number
          pan_document_path?: string | null
          pan_name?: string
          pan_number?: string
          payu_document_status?: string | null
          payu_error?: string | null
          payu_kyc_status?: string | null
          payu_merchant_key?: string | null
          payu_mid?: string | null
          payu_onboarding_status?: string | null
          payu_product_account_uuid?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          schedule_c_document_path?: string | null
          shop_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shop_payu_kyc_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: true
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_kyc_documents: {
        Row: {
          created_at: string
          file_size: number | null
          id: string
          kind: string
          mime_type: string | null
          payu_document_status: string | null
          payu_document_uuid: string | null
          rejection_reason: string | null
          shop_id: string
          storage_path: string
          updated_at: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          file_size?: number | null
          id?: string
          kind: string
          mime_type?: string | null
          payu_document_status?: string | null
          payu_document_uuid?: string | null
          rejection_reason?: string | null
          shop_id: string
          storage_path: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          file_size?: number | null
          id?: string
          kind?: string
          mime_type?: string | null
          payu_document_status?: string | null
          payu_document_uuid?: string | null
          rejection_reason?: string | null
          shop_id?: string
          storage_path?: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shop_kyc_documents_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_legal_documents: {
        Row: {
          body_markdown: string
          created_at: string
          doc_type: string
          id: string
          is_published: boolean
          shop_id: string
          title: string
          updated_at: string
        }
        Insert: {
          body_markdown?: string
          created_at?: string
          doc_type: string
          id?: string
          is_published?: boolean
          shop_id: string
          title?: string
          updated_at?: string
        }
        Update: {
          body_markdown?: string
          created_at?: string
          doc_type?: string
          id?: string
          is_published?: boolean
          shop_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shop_legal_documents_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "active_listings_view"
            referencedColumns: ["shop_id"]
          },
          {
            foreignKeyName: "shop_legal_documents_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "payment_analytics"
            referencedColumns: ["shop_id"]
          },
          {
            foreignKeyName: "shop_legal_documents_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shop_listings_summary"
            referencedColumns: ["shop_id"]
          },
          {
            foreignKeyName: "shop_legal_documents_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_payment_accounts: {
        Row: {
          access_token: string | null
          connected_at: string | null
          created_at: string | null
          id: string
          last_sync_at: string | null
          merchant_id: string
          metadata: Json | null
          provider: Database["public"]["Enums"]["payment_provider_enum"]
          refresh_token: string | null
          shop_id: string
          status:
            | Database["public"]["Enums"]["payment_account_status_enum"]
            | null
          token_expiry: string | null
          updated_at: string | null
        }
        Insert: {
          access_token?: string | null
          connected_at?: string | null
          created_at?: string | null
          id?: string
          last_sync_at?: string | null
          merchant_id: string
          metadata?: Json | null
          provider: Database["public"]["Enums"]["payment_provider_enum"]
          refresh_token?: string | null
          shop_id: string
          status?:
            | Database["public"]["Enums"]["payment_account_status_enum"]
            | null
          token_expiry?: string | null
          updated_at?: string | null
        }
        Update: {
          access_token?: string | null
          connected_at?: string | null
          created_at?: string | null
          id?: string
          last_sync_at?: string | null
          merchant_id?: string
          metadata?: Json | null
          provider?: Database["public"]["Enums"]["payment_provider_enum"]
          refresh_token?: string | null
          shop_id?: string
          status?:
            | Database["public"]["Enums"]["payment_account_status_enum"]
            | null
          token_expiry?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shop_payment_accounts_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "active_listings_view"
            referencedColumns: ["shop_id"]
          },
          {
            foreignKeyName: "shop_payment_accounts_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "payment_analytics"
            referencedColumns: ["shop_id"]
          },
          {
            foreignKeyName: "shop_payment_accounts_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shop_listings_summary"
            referencedColumns: ["shop_id"]
          },
          {
            foreignKeyName: "shop_payment_accounts_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_review_helpfulness: {
        Row: {
          created_at: string
          id: string
          is_helpful: boolean
          review_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_helpful: boolean
          review_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_helpful?: boolean
          review_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shop_review_helpfulness_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "shop_reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_review_reports: {
        Row: {
          created_at: string
          id: string
          report_description: string | null
          report_reason: string
          report_status: string
          reporter_id: string
          review_id: string
          reviewed_at: string | null
          reviewed_by: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          report_description?: string | null
          report_reason: string
          report_status?: string
          reporter_id: string
          review_id: string
          reviewed_at?: string | null
          reviewed_by?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          report_description?: string | null
          report_reason?: string
          report_status?: string
          reporter_id?: string
          review_id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shop_review_reports_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "shop_reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_review_responses: {
        Row: {
          created_at: string
          id: string
          is_public: boolean
          response_text: string
          review_id: string
          shop_owner_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_public?: boolean
          response_text: string
          review_id: string
          shop_owner_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_public?: boolean
          response_text?: string
          review_id?: string
          shop_owner_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shop_review_responses_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: true
            referencedRelation: "shop_reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_reviews: {
        Row: {
          created_at: string
          customer_service_rating: number | null
          helpful_count: number
          id: string
          is_verified_purchase: boolean
          moderated_at: string | null
          moderated_by: string | null
          moderation_reason: string | null
          not_helpful_count: number
          order_id: string | null
          product_quality_rating: number | null
          rating: number
          review_images: Json
          review_metadata: Json
          review_status: Database["public"]["Enums"]["review_status_enum"]
          review_text: string | null
          reviewer_id: string
          shipping_speed_rating: number | null
          shop_id: string
          title: string | null
          updated_at: string
          value_for_money_rating: number | null
        }
        Insert: {
          created_at?: string
          customer_service_rating?: number | null
          helpful_count?: number
          id?: string
          is_verified_purchase?: boolean
          moderated_at?: string | null
          moderated_by?: string | null
          moderation_reason?: string | null
          not_helpful_count?: number
          order_id?: string | null
          product_quality_rating?: number | null
          rating: number
          review_images?: Json
          review_metadata?: Json
          review_status?: Database["public"]["Enums"]["review_status_enum"]
          review_text?: string | null
          reviewer_id: string
          shipping_speed_rating?: number | null
          shop_id: string
          title?: string | null
          updated_at?: string
          value_for_money_rating?: number | null
        }
        Update: {
          created_at?: string
          customer_service_rating?: number | null
          helpful_count?: number
          id?: string
          is_verified_purchase?: boolean
          moderated_at?: string | null
          moderated_by?: string | null
          moderation_reason?: string | null
          not_helpful_count?: number
          order_id?: string | null
          product_quality_rating?: number | null
          rating?: number
          review_images?: Json
          review_metadata?: Json
          review_status?: Database["public"]["Enums"]["review_status_enum"]
          review_text?: string | null
          reviewer_id?: string
          shipping_speed_rating?: number | null
          shop_id?: string
          title?: string | null
          updated_at?: string
          value_for_money_rating?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "shop_reviews_reviewer_id_fkey1"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_reviews_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "active_listings_view"
            referencedColumns: ["shop_id"]
          },
          {
            foreignKeyName: "shop_reviews_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "payment_analytics"
            referencedColumns: ["shop_id"]
          },
          {
            foreignKeyName: "shop_reviews_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shop_listings_summary"
            referencedColumns: ["shop_id"]
          },
          {
            foreignKeyName: "shop_reviews_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_sections: {
        Row: {
          created_at: string
          description: string | null
          display_order: number
          id: string
          is_active: boolean
          section_metadata: Json
          section_name: string
          shop_id: string
          slug: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          section_metadata?: Json
          section_name: string
          shop_id: string
          slug?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          section_metadata?: Json
          section_name?: string
          shop_id?: string
          slug?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shop_sections_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "active_listings_view"
            referencedColumns: ["shop_id"]
          },
          {
            foreignKeyName: "shop_sections_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "payment_analytics"
            referencedColumns: ["shop_id"]
          },
          {
            foreignKeyName: "shop_sections_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shop_listings_summary"
            referencedColumns: ["shop_id"]
          },
          {
            foreignKeyName: "shop_sections_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_shipping_accounts: {
        Row: {
          access_token: string | null
          created_at: string | null
          credentials: Json | null
          id: string
          provider: Database["public"]["Enums"]["shipping_provider_enum"]
          shop_id: string
          status:
            | Database["public"]["Enums"]["shipping_account_status_enum"]
            | null
          token_expiry: string | null
          updated_at: string | null
        }
        Insert: {
          access_token?: string | null
          created_at?: string | null
          credentials?: Json | null
          id?: string
          provider: Database["public"]["Enums"]["shipping_provider_enum"]
          shop_id: string
          status?:
            | Database["public"]["Enums"]["shipping_account_status_enum"]
            | null
          token_expiry?: string | null
          updated_at?: string | null
        }
        Update: {
          access_token?: string | null
          created_at?: string | null
          credentials?: Json | null
          id?: string
          provider?: Database["public"]["Enums"]["shipping_provider_enum"]
          shop_id?: string
          status?:
            | Database["public"]["Enums"]["shipping_account_status_enum"]
            | null
          token_expiry?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shop_shipping_accounts_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "active_listings_view"
            referencedColumns: ["shop_id"]
          },
          {
            foreignKeyName: "shop_shipping_accounts_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "payment_analytics"
            referencedColumns: ["shop_id"]
          },
          {
            foreignKeyName: "shop_shipping_accounts_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shop_listings_summary"
            referencedColumns: ["shop_id"]
          },
          {
            foreignKeyName: "shop_shipping_accounts_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      shops: {
        Row: {
          average_rating: number | null
          canonical_url: string | null
          created_at: string
          id: string
          is_active: boolean
          logo_url: string | null
          meta_description: string | null
          meta_title: string | null
          open_graph_description: string | null
          open_graph_image: string | null
          open_graph_title: string | null
          robots_follow: boolean | null
          robots_index: boolean | null
          seo_description: string | null
          seo_keywords: string[] | null
          seo_priority: number | null
          seo_title: string | null
          shop_address_id: string | null
          shop_categories: Json
          shop_currency: string
          shop_description: string | null
          shop_email: string | null
          shop_hours: Json
          shop_metadata: Json
          shop_name: string
          shop_phone_number: string | null
          slug: string | null
          social_links: Json
          tax_configuration: Json | null
          total_reviews: number | null
          twitter_card_type: string | null
          twitter_description: string | null
          twitter_image: string | null
          twitter_title: string | null
          updated_at: string
          user_id: string
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
          verified: boolean
          website_url: string | null
        }
        Insert: {
          average_rating?: number | null
          canonical_url?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          logo_url?: string | null
          meta_description?: string | null
          meta_title?: string | null
          open_graph_description?: string | null
          open_graph_image?: string | null
          open_graph_title?: string | null
          robots_follow?: boolean | null
          robots_index?: boolean | null
          seo_description?: string | null
          seo_keywords?: string[] | null
          seo_priority?: number | null
          seo_title?: string | null
          shop_address_id?: string | null
          shop_categories?: Json
          shop_currency?: string
          shop_description?: string | null
          shop_email?: string | null
          shop_hours?: Json
          shop_metadata?: Json
          shop_name: string
          shop_phone_number?: string | null
          slug?: string | null
          social_links?: Json
          tax_configuration?: Json | null
          total_reviews?: number | null
          twitter_card_type?: string | null
          twitter_description?: string | null
          twitter_image?: string | null
          twitter_title?: string | null
          updated_at?: string
          user_id: string
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          verified?: boolean
          website_url?: string | null
        }
        Update: {
          average_rating?: number | null
          canonical_url?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          logo_url?: string | null
          meta_description?: string | null
          meta_title?: string | null
          open_graph_description?: string | null
          open_graph_image?: string | null
          open_graph_title?: string | null
          robots_follow?: boolean | null
          robots_index?: boolean | null
          seo_description?: string | null
          seo_keywords?: string[] | null
          seo_priority?: number | null
          seo_title?: string | null
          shop_address_id?: string | null
          shop_categories?: Json
          shop_currency?: string
          shop_description?: string | null
          shop_email?: string | null
          shop_hours?: Json
          shop_metadata?: Json
          shop_name?: string
          shop_phone_number?: string | null
          slug?: string | null
          social_links?: Json
          tax_configuration?: Json | null
          total_reviews?: number | null
          twitter_card_type?: string | null
          twitter_description?: string | null
          twitter_image?: string | null
          twitter_title?: string | null
          updated_at?: string
          user_id?: string
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          verified?: boolean
          website_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shops_shop_address_id_fkey"
            columns: ["shop_address_id"]
            isOneToOne: false
            referencedRelation: "addresses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shops_shop_address_id_fkey"
            columns: ["shop_address_id"]
            isOneToOne: false
            referencedRelation: "shop_addresses"
            referencedColumns: ["id"]
          },
        ]
      }
      skill_endorsements: {
        Row: {
          created_at: string | null
          endorsed_by: string
          id: string
          skill_name: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          endorsed_by: string
          id?: string
          skill_name: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          endorsed_by?: string
          id?: string
          skill_name?: string
          user_id?: string
        }
        Relationships: []
      }
      skills: {
        Row: {
          created_at: string | null
          endorsements_count: number | null
          id: string
          proficiency_level: string | null
          skill_name: string
          user_id: string | null
          years_of_experience: number | null
        }
        Insert: {
          created_at?: string | null
          endorsements_count?: number | null
          id?: string
          proficiency_level?: string | null
          skill_name: string
          user_id?: string | null
          years_of_experience?: number | null
        }
        Update: {
          created_at?: string | null
          endorsements_count?: number | null
          id?: string
          proficiency_level?: string | null
          skill_name?: string
          user_id?: string | null
          years_of_experience?: number | null
        }
        Relationships: []
      }
      slides: {
        Row: {
          badge_text: string | null
          created_at: string | null
          cta: string | null
          cta_link: string | null
          description: string | null
          id: string
          image: string
          is_active: boolean | null
          meta_data: Json | null
          secondary_cta: string | null
          secondary_cta_link: string | null
          sort_order: number | null
          stats: Json | null
          subtitle: string | null
          title: string
          type: string | null
          updated_at: string | null
        }
        Insert: {
          badge_text?: string | null
          created_at?: string | null
          cta?: string | null
          cta_link?: string | null
          description?: string | null
          id?: string
          image: string
          is_active?: boolean | null
          meta_data?: Json | null
          secondary_cta?: string | null
          secondary_cta_link?: string | null
          sort_order?: number | null
          stats?: Json | null
          subtitle?: string | null
          title: string
          type?: string | null
          updated_at?: string | null
        }
        Update: {
          badge_text?: string | null
          created_at?: string | null
          cta?: string | null
          cta_link?: string | null
          description?: string | null
          id?: string
          image?: string
          is_active?: boolean | null
          meta_data?: Json | null
          secondary_cta?: string | null
          secondary_cta_link?: string | null
          sort_order?: number | null
          stats?: Json | null
          subtitle?: string | null
          title?: string
          type?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      smart_suggestions: {
        Row: {
          context_page: string | null
          created_at: string | null
          icon_name: string | null
          id: string
          is_active: boolean | null
          priority: number | null
          product: string | null
          success_rate: number | null
          suggestion_action: string
          suggestion_text: string
          updated_at: string | null
          usage_count: number | null
          user_type: string
        }
        Insert: {
          context_page?: string | null
          created_at?: string | null
          icon_name?: string | null
          id?: string
          is_active?: boolean | null
          priority?: number | null
          product?: string | null
          success_rate?: number | null
          suggestion_action: string
          suggestion_text: string
          updated_at?: string | null
          usage_count?: number | null
          user_type: string
        }
        Update: {
          context_page?: string | null
          created_at?: string | null
          icon_name?: string | null
          id?: string
          is_active?: boolean | null
          priority?: number | null
          product?: string | null
          success_rate?: number | null
          suggestion_action?: string
          suggestion_text?: string
          updated_at?: string | null
          usage_count?: number | null
          user_type?: string
        }
        Relationships: []
      }
      sponsored_campaign_audit_log: {
        Row: {
          action: string
          actor_id: string | null
          campaign_id: string
          created_at: string
          from_status: string | null
          id: string
          metadata: Json
          note: string | null
          to_status: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          campaign_id: string
          created_at?: string
          from_status?: string | null
          id?: string
          metadata?: Json
          note?: string | null
          to_status?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          campaign_id?: string
          created_at?: string
          from_status?: string | null
          id?: string
          metadata?: Json
          note?: string | null
          to_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sponsored_campaign_audit_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sponsored_campaign_audit_log_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "sponsored_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      sponsored_campaign_daily_metrics: {
        Row: {
          campaign_id: string
          clicks: number
          impressions: number
          metric_date: string
          spend: number
          unique_viewers: number
          updated_at: string
        }
        Insert: {
          campaign_id: string
          clicks?: number
          impressions?: number
          metric_date: string
          spend?: number
          unique_viewers?: number
          updated_at?: string
        }
        Update: {
          campaign_id?: string
          clicks?: number
          impressions?: number
          metric_date?: string
          spend?: number
          unique_viewers?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sponsored_campaign_daily_metrics_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "sponsored_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      sponsored_campaign_events: {
        Row: {
          campaign_id: string
          event_key: string
          event_type: string
          id: string
          metadata: Json
          occurred_at: string
          placement: string
          post_id: string
          session_id: string | null
          viewer_id: string | null
        }
        Insert: {
          campaign_id: string
          event_key: string
          event_type: string
          id?: string
          metadata?: Json
          occurred_at?: string
          placement?: string
          post_id: string
          session_id?: string | null
          viewer_id?: string | null
        }
        Update: {
          campaign_id?: string
          event_key?: string
          event_type?: string
          id?: string
          metadata?: Json
          occurred_at?: string
          placement?: string
          post_id?: string
          session_id?: string | null
          viewer_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sponsored_campaign_events_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "sponsored_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sponsored_campaign_events_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sponsored_campaign_events_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts_with_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sponsored_campaign_events_viewer_id_fkey"
            columns: ["viewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sponsored_campaign_payments: {
        Row: {
          advertiser_user_id: string
          amount: number
          campaign_id: string
          created_at: string
          currency: string
          failure_code: string | null
          failure_reason: string | null
          gateway_transaction_id: string | null
          id: string
          processed_at: string | null
          provider: string
          provider_response: Json
          refunded_at: string | null
          status: string
          transaction_id: string
          updated_at: string
        }
        Insert: {
          advertiser_user_id: string
          amount: number
          campaign_id: string
          created_at?: string
          currency?: string
          failure_code?: string | null
          failure_reason?: string | null
          gateway_transaction_id?: string | null
          id?: string
          processed_at?: string | null
          provider?: string
          provider_response?: Json
          refunded_at?: string | null
          status?: string
          transaction_id: string
          updated_at?: string
        }
        Update: {
          advertiser_user_id?: string
          amount?: number
          campaign_id?: string
          created_at?: string
          currency?: string
          failure_code?: string | null
          failure_reason?: string | null
          gateway_transaction_id?: string | null
          id?: string
          processed_at?: string | null
          provider?: string
          provider_response?: Json
          refunded_at?: string | null
          status?: string
          transaction_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sponsored_campaign_payments_advertiser_user_id_fkey"
            columns: ["advertiser_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sponsored_campaign_payments_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "sponsored_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      sponsored_campaigns: {
        Row: {
          advertiser_user_id: string
          audience: Json
          call_to_action: string
          cancelled_at: string | null
          click_count: number
          company_id: string | null
          completed_at: string | null
          cost_per_impression: number
          created_at: string
          currency: string
          daily_budget: number
          destination_url: string | null
          ends_at: string
          frequency_cap_per_day: number
          id: string
          impression_count: number
          name: string
          objective: string
          paid_at: string | null
          post_id: string
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          spent_amount: number
          starts_at: string
          status: string
          total_budget: number
          updated_at: string
        }
        Insert: {
          advertiser_user_id: string
          audience?: Json
          call_to_action?: string
          cancelled_at?: string | null
          click_count?: number
          company_id?: string | null
          completed_at?: string | null
          cost_per_impression?: number
          created_at?: string
          currency?: string
          daily_budget: number
          destination_url?: string | null
          ends_at: string
          frequency_cap_per_day?: number
          id?: string
          impression_count?: number
          name: string
          objective?: string
          paid_at?: string | null
          post_id: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          spent_amount?: number
          starts_at: string
          status?: string
          total_budget: number
          updated_at?: string
        }
        Update: {
          advertiser_user_id?: string
          audience?: Json
          call_to_action?: string
          cancelled_at?: string | null
          click_count?: number
          company_id?: string | null
          completed_at?: string | null
          cost_per_impression?: number
          created_at?: string
          currency?: string
          daily_budget?: number
          destination_url?: string | null
          ends_at?: string
          frequency_cap_per_day?: number
          id?: string
          impression_count?: number
          name?: string
          objective?: string
          paid_at?: string | null
          post_id?: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          spent_amount?: number
          starts_at?: string
          status?: string
          total_budget?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sponsored_campaigns_advertiser_user_id_fkey"
            columns: ["advertiser_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sponsored_campaigns_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companypages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sponsored_campaigns_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sponsored_campaigns_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts_with_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sponsored_campaigns_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      status_reactions: {
        Row: {
          created_at: string | null
          emoji: string
          id: string
          status_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          emoji: string
          id?: string
          status_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          emoji?: string
          id?: string
          status_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "status_reactions_status_id_fkey"
            columns: ["status_id"]
            isOneToOne: false
            referencedRelation: "statuses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "status_reactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      status_views: {
        Row: {
          id: string
          status_id: string | null
          viewed_at: string | null
          viewer_id: string | null
        }
        Insert: {
          id?: string
          status_id?: string | null
          viewed_at?: string | null
          viewer_id?: string | null
        }
        Update: {
          id?: string
          status_id?: string | null
          viewed_at?: string | null
          viewer_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "status_views_status_id_fkey"
            columns: ["status_id"]
            isOneToOne: false
            referencedRelation: "statuses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "status_views_viewer_id_fkey"
            columns: ["viewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      statuses: {
        Row: {
          background_color: string | null
          content: string | null
          created_at: string | null
          expires_at: string | null
          font_size: number | null
          id: string
          is_active: boolean | null
          media_type: string | null
          media_url: string | null
          privacy_level: string | null
          text_color: string | null
          updated_at: string | null
          user_id: string | null
          view_count: number | null
        }
        Insert: {
          background_color?: string | null
          content?: string | null
          created_at?: string | null
          expires_at?: string | null
          font_size?: number | null
          id?: string
          is_active?: boolean | null
          media_type?: string | null
          media_url?: string | null
          privacy_level?: string | null
          text_color?: string | null
          updated_at?: string | null
          user_id?: string | null
          view_count?: number | null
        }
        Update: {
          background_color?: string | null
          content?: string | null
          created_at?: string | null
          expires_at?: string | null
          font_size?: number | null
          id?: string
          is_active?: boolean | null
          media_type?: string | null
          media_url?: string | null
          privacy_level?: string | null
          text_color?: string | null
          updated_at?: string | null
          user_id?: string | null
          view_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "statuses_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      stories: {
        Row: {
          background_color: string | null
          content: string | null
          created_at: string | null
          expires_at: string | null
          font_size: number | null
          id: string
          is_active: boolean | null
          media_type: string | null
          media_url: string | null
          privacy_level: string | null
          text_color: string | null
          updated_at: string | null
          user_id: string
          view_count: number | null
        }
        Insert: {
          background_color?: string | null
          content?: string | null
          created_at?: string | null
          expires_at?: string | null
          font_size?: number | null
          id?: string
          is_active?: boolean | null
          media_type?: string | null
          media_url?: string | null
          privacy_level?: string | null
          text_color?: string | null
          updated_at?: string | null
          user_id: string
          view_count?: number | null
        }
        Update: {
          background_color?: string | null
          content?: string | null
          created_at?: string | null
          expires_at?: string | null
          font_size?: number | null
          id?: string
          is_active?: boolean | null
          media_type?: string | null
          media_url?: string | null
          privacy_level?: string | null
          text_color?: string | null
          updated_at?: string | null
          user_id?: string
          view_count?: number | null
        }
        Relationships: []
      }
      story_views: {
        Row: {
          id: string
          story_id: string
          viewed_at: string | null
          viewer_id: string
        }
        Insert: {
          id?: string
          story_id: string
          viewed_at?: string | null
          viewer_id: string
        }
        Update: {
          id?: string
          story_id?: string
          viewed_at?: string | null
          viewer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "story_views_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "stories"
            referencedColumns: ["id"]
          },
        ]
      }
      support_agents: {
        Row: {
          average_response_time_seconds: number | null
          created_at: string
          current_conversations: number | null
          customer_satisfaction_rating: number | null
          id: string
          is_active: boolean | null
          is_available: boolean | null
          last_active_at: string | null
          max_concurrent_conversations: number | null
          total_conversations_handled: number | null
          user_id: string
        }
        Insert: {
          average_response_time_seconds?: number | null
          created_at?: string
          current_conversations?: number | null
          customer_satisfaction_rating?: number | null
          id?: string
          is_active?: boolean | null
          is_available?: boolean | null
          last_active_at?: string | null
          max_concurrent_conversations?: number | null
          total_conversations_handled?: number | null
          user_id: string
        }
        Update: {
          average_response_time_seconds?: number | null
          created_at?: string
          current_conversations?: number | null
          customer_satisfaction_rating?: number | null
          id?: string
          is_active?: boolean | null
          is_available?: boolean | null
          last_active_at?: string | null
          max_concurrent_conversations?: number | null
          total_conversations_handled?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_agents_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      support_conversations: {
        Row: {
          assigned_to: string | null
          created_at: string
          customer_satisfaction_rating: number | null
          id: string
          priority: string | null
          resolved_at: string | null
          status: string
          tags: string[] | null
          updated_at: string
          user_id: string
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          customer_satisfaction_rating?: number | null
          id?: string
          priority?: string | null
          resolved_at?: string | null
          status?: string
          tags?: string[] | null
          updated_at?: string
          user_id: string
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          customer_satisfaction_rating?: number | null
          id?: string
          priority?: string | null
          resolved_at?: string | null
          status?: string
          tags?: string[] | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_conversations_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_conversations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      support_interactions: {
        Row: {
          ai_response: string | null
          created_at: string | null
          id: string
          query: string
          user_id: string | null
          user_type: string
        }
        Insert: {
          ai_response?: string | null
          created_at?: string | null
          id?: string
          query: string
          user_id?: string | null
          user_type?: string
        }
        Update: {
          ai_response?: string | null
          created_at?: string | null
          id?: string
          query?: string
          user_id?: string | null
          user_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_interactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      support_knowledge_base: {
        Row: {
          category: string
          content: string
          created_at: string
          helpful_count: number | null
          id: string
          is_active: boolean | null
          slug: string | null
          tags: string[] | null
          title: string
          updated_at: string
          user_type: string
          view_count: number | null
        }
        Insert: {
          category: string
          content: string
          created_at?: string
          helpful_count?: number | null
          id?: string
          is_active?: boolean | null
          slug?: string | null
          tags?: string[] | null
          title: string
          updated_at?: string
          user_type?: string
          view_count?: number | null
        }
        Update: {
          category?: string
          content?: string
          created_at?: string
          helpful_count?: number | null
          id?: string
          is_active?: boolean | null
          slug?: string | null
          tags?: string[] | null
          title?: string
          updated_at?: string
          user_type?: string
          view_count?: number | null
        }
        Relationships: []
      }
      support_messages: {
        Row: {
          attachment_url: string | null
          content: string
          conversation_id: string
          created_at: string
          id: string
          message_type: string | null
          metadata: Json | null
          read_at: string | null
          sender_id: string | null
          sender_type: string
        }
        Insert: {
          attachment_url?: string | null
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          message_type?: string | null
          metadata?: Json | null
          read_at?: string | null
          sender_id?: string | null
          sender_type: string
        }
        Update: {
          attachment_url?: string | null
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          message_type?: string | null
          metadata?: Json | null
          read_at?: string | null
          sender_id?: string | null
          sender_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "support_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          created_at: string | null
          description: string
          id: string
          priority: string
          product: string | null
          status: string | null
          subject: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          description: string
          id?: string
          priority?: string
          product?: string | null
          status?: string | null
          subject: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string
          id?: string
          priority?: string
          product?: string | null
          status?: string | null
          subject?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "support_tickets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tax_categories: {
        Row: {
          category_name: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          updated_at: string
        }
        Insert: {
          category_name: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          updated_at?: string
        }
        Update: {
          category_name?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      tax_tiers: {
        Row: {
          created_at: string
          id: string
          max_amount: number | null
          min_amount: number
          tax_id: string
          tier_order: number
          tier_rate: number
        }
        Insert: {
          created_at?: string
          id?: string
          max_amount?: number | null
          min_amount: number
          tax_id: string
          tier_order: number
          tier_rate: number
        }
        Update: {
          created_at?: string
          id?: string
          max_amount?: number | null
          min_amount?: number
          tax_id?: string
          tier_order?: number
          tier_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "tax_tiers_tax_id_fkey"
            columns: ["tax_id"]
            isOneToOne: false
            referencedRelation: "taxes"
            referencedColumns: ["id"]
          },
        ]
      }
      taxes: {
        Row: {
          applies_to_digital: boolean
          applies_to_physical: boolean
          applies_to_services: boolean
          applies_to_shipping: boolean
          city: string | null
          country: string
          created_at: string
          effective_from: string
          effective_until: string | null
          id: string
          is_active: boolean
          maximum_taxable_amount: number | null
          minimum_taxable_amount: number | null
          postal_code_pattern: string | null
          state_province: string | null
          tax_category_id: string
          tax_metadata: Json
          tax_name: string
          tax_rate: number
          tax_type: string
          updated_at: string
        }
        Insert: {
          applies_to_digital?: boolean
          applies_to_physical?: boolean
          applies_to_services?: boolean
          applies_to_shipping?: boolean
          city?: string | null
          country: string
          created_at?: string
          effective_from?: string
          effective_until?: string | null
          id?: string
          is_active?: boolean
          maximum_taxable_amount?: number | null
          minimum_taxable_amount?: number | null
          postal_code_pattern?: string | null
          state_province?: string | null
          tax_category_id: string
          tax_metadata?: Json
          tax_name: string
          tax_rate: number
          tax_type: string
          updated_at?: string
        }
        Update: {
          applies_to_digital?: boolean
          applies_to_physical?: boolean
          applies_to_services?: boolean
          applies_to_shipping?: boolean
          city?: string | null
          country?: string
          created_at?: string
          effective_from?: string
          effective_until?: string | null
          id?: string
          is_active?: boolean
          maximum_taxable_amount?: number | null
          minimum_taxable_amount?: number | null
          postal_code_pattern?: string | null
          state_province?: string | null
          tax_category_id?: string
          tax_metadata?: Json
          tax_name?: string
          tax_rate?: number
          tax_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "taxes_tax_category_id_fkey"
            columns: ["tax_category_id"]
            isOneToOne: false
            referencedRelation: "tax_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      trigger_test_log: {
        Row: {
          created_at: string | null
          id: number
          message: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: number
          message?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: number
          message?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      typing_indicators: {
        Row: {
          conversation_id: string | null
          id: string
          is_typing: boolean | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          conversation_id?: string | null
          id?: string
          is_typing?: boolean | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          conversation_id?: string | null
          id?: string
          is_typing?: boolean | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "typing_indicators_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "typing_indicators_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      url_metadata: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          image_url: string | null
          site_name: string | null
          title: string | null
          type: string | null
          url: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          site_name?: string | null
          title?: string | null
          type?: string | null
          url: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          site_name?: string | null
          title?: string | null
          type?: string | null
          url?: string
        }
        Relationships: []
      }
      user_behavior_events: {
        Row: {
          created_at: string
          entity_id: string | null
          entity_type: string | null
          event_type: string
          guest_session_id: string | null
          id: string
          metadata: Json | null
          platform: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          event_type: string
          guest_session_id?: string | null
          id?: string
          metadata?: Json | null
          platform?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          event_type?: string
          guest_session_id?: string | null
          id?: string
          metadata?: Json | null
          platform?: string
          user_id?: string | null
        }
        Relationships: []
      }
      user_blocks: {
        Row: {
          blocked_id: string
          blocker_id: string
          created_at: string
          id: string
        }
        Insert: {
          blocked_id: string
          blocker_id: string
          created_at?: string
          id?: string
        }
        Update: {
          blocked_id?: string
          blocker_id?: string
          created_at?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_blocks_blocked_id_fkey"
            columns: ["blocked_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_blocks_blocker_id_fkey"
            columns: ["blocker_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_imported_contacts: {
        Row: {
          consent: boolean
          consented_at: string
          created_at: string
          display_name: string
          emails: string[]
          id: string
          phone_numbers: string[]
          user_id: string
        }
        Insert: {
          consent?: boolean
          consented_at?: string
          created_at?: string
          display_name: string
          emails?: string[]
          id?: string
          phone_numbers?: string[]
          user_id: string
        }
        Update: {
          consent?: boolean
          consented_at?: string
          created_at?: string
          display_name?: string
          emails?: string[]
          id?: string
          phone_numbers?: string[]
          user_id?: string
        }
        Relationships: []
      }
      user_push_devices: {
        Row: {
          created_at: string
          enabled: boolean
          id: string
          platform: string
          player_id: string
          provider: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          id?: string
          platform?: string
          player_id: string
          provider?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          id?: string
          platform?: string
          player_id?: string
          provider?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_reports: {
        Row: {
          created_at: string | null
          id: string
          reason: string
          reported_user_id: string
          reporter_id: string
          status: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          reason: string
          reported_user_id: string
          reporter_id: string
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          reason?: string
          reported_user_id?: string
          reporter_id?: string
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_reports_reported_user_id_fkey"
            columns: ["reported_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_suggestions: {
        Row: {
          created_at: string | null
          id: string
          is_dismissed: boolean | null
          reason: string | null
          score: number | null
          suggested_user_id: string
          suggestion_type: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_dismissed?: boolean | null
          reason?: string | null
          score?: number | null
          suggested_user_id: string
          suggestion_type?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_dismissed?: boolean | null
          reason?: string | null
          score?: number | null
          suggested_user_id?: string
          suggestion_type?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      username_history: {
        Row: {
          changed_at: string
          id: string
          profile_id: string
          username: string
        }
        Insert: {
          changed_at?: string
          id?: string
          profile_id: string
          username: string
        }
        Update: {
          changed_at?: string
          id?: string
          profile_id?: string
          username?: string
        }
        Relationships: [
          {
            foreignKeyName: "username_history_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_event_enrollments: {
        Row: {
          enrolled_at: string
          enrollment_status: string
          event_id: string
          id: string
          shop_id: string
          updated_at: string
        }
        Insert: {
          enrolled_at?: string
          enrollment_status?: string
          event_id: string
          id?: string
          shop_id: string
          updated_at?: string
        }
        Update: {
          enrolled_at?: string
          enrollment_status?: string
          event_id?: string
          id?: string
          shop_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_event_enrollments_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "sale_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_event_enrollments_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "active_listings_view"
            referencedColumns: ["shop_id"]
          },
          {
            foreignKeyName: "vendor_event_enrollments_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "payment_analytics"
            referencedColumns: ["shop_id"]
          },
          {
            foreignKeyName: "vendor_event_enrollments_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shop_listings_summary"
            referencedColumns: ["shop_id"]
          },
          {
            foreignKeyName: "vendor_event_enrollments_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_notification_campaigns: {
        Row: {
          action_url: string | null
          budget_amount: number | null
          campaign_name: string
          campaign_type: string
          created_at: string
          created_by: string
          estimated_reach: number | null
          id: string
          message_body: string | null
          metadata: Json | null
          scheduled_for: string | null
          shop_id: string
          status: string
          target_audience: string
          updated_at: string
        }
        Insert: {
          action_url?: string | null
          budget_amount?: number | null
          campaign_name: string
          campaign_type?: string
          created_at?: string
          created_by: string
          estimated_reach?: number | null
          id?: string
          message_body?: string | null
          metadata?: Json | null
          scheduled_for?: string | null
          shop_id: string
          status?: string
          target_audience?: string
          updated_at?: string
        }
        Update: {
          action_url?: string | null
          budget_amount?: number | null
          campaign_name?: string
          campaign_type?: string
          created_at?: string
          created_by?: string
          estimated_reach?: number | null
          id?: string
          message_body?: string | null
          metadata?: Json | null
          scheduled_for?: string | null
          shop_id?: string
          status?: string
          target_audience?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_notification_campaigns_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "active_listings_view"
            referencedColumns: ["shop_id"]
          },
          {
            foreignKeyName: "vendor_notification_campaigns_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "payment_analytics"
            referencedColumns: ["shop_id"]
          },
          {
            foreignKeyName: "vendor_notification_campaigns_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shop_listings_summary"
            referencedColumns: ["shop_id"]
          },
          {
            foreignKeyName: "vendor_notification_campaigns_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_oauth_tokens: {
        Row: {
          access_token: string
          created_at: string
          expires_at: string | null
          id: string
          platform: string
          refresh_token: string | null
          scope: string | null
          token_type: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token: string
          created_at?: string
          expires_at?: string | null
          id?: string
          platform: string
          refresh_token?: string | null
          scope?: string | null
          token_type?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          platform?: string
          refresh_token?: string | null
          scope?: string | null
          token_type?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      vendor_payment_settings: {
        Row: {
          accepts_international: boolean | null
          auto_settlement: boolean | null
          created_at: string | null
          fx_markup_percent: number | null
          id: string
          is_live_mode: boolean | null
          minimum_settlement_amount: number | null
          settlement_currency: string | null
          settlement_schedule: string | null
          shop_id: string
          updated_at: string | null
          webhook_secret: string | null
          webhook_url: string | null
        }
        Insert: {
          accepts_international?: boolean | null
          auto_settlement?: boolean | null
          created_at?: string | null
          fx_markup_percent?: number | null
          id?: string
          is_live_mode?: boolean | null
          minimum_settlement_amount?: number | null
          settlement_currency?: string | null
          settlement_schedule?: string | null
          shop_id: string
          updated_at?: string | null
          webhook_secret?: string | null
          webhook_url?: string | null
        }
        Update: {
          accepts_international?: boolean | null
          auto_settlement?: boolean | null
          created_at?: string | null
          fx_markup_percent?: number | null
          id?: string
          is_live_mode?: boolean | null
          minimum_settlement_amount?: number | null
          settlement_currency?: string | null
          settlement_schedule?: string | null
          shop_id?: string
          updated_at?: string | null
          webhook_secret?: string | null
          webhook_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vendor_payment_settings_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: true
            referencedRelation: "active_listings_view"
            referencedColumns: ["shop_id"]
          },
          {
            foreignKeyName: "vendor_payment_settings_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: true
            referencedRelation: "payment_analytics"
            referencedColumns: ["shop_id"]
          },
          {
            foreignKeyName: "vendor_payment_settings_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: true
            referencedRelation: "shop_listings_summary"
            referencedColumns: ["shop_id"]
          },
          {
            foreignKeyName: "vendor_payment_settings_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: true
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      virtual_backgrounds: {
        Row: {
          background_type: string
          blur_enabled: boolean | null
          created_at: string | null
          id: string
          image_url: string
          is_default: boolean | null
          name: string
          solid_color: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          background_type?: string
          blur_enabled?: boolean | null
          created_at?: string | null
          id?: string
          image_url: string
          is_default?: boolean | null
          name: string
          solid_color?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          background_type?: string
          blur_enabled?: boolean | null
          created_at?: string | null
          id?: string
          image_url?: string
          is_default?: boolean | null
          name?: string
          solid_color?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      wallet_accounts: {
        Row: {
          created_at: string
          currency: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          currency: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          currency?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      wallet_ledger_entries: {
        Row: {
          account_id: string
          amount: number
          available_at: string | null
          created_at: string
          currency: string
          description: string | null
          entry_type: Database["public"]["Enums"]["wallet_entry_type_enum"]
          id: string
          metadata: Json
          order_id: string | null
          status: Database["public"]["Enums"]["wallet_entry_status_enum"]
          topup_id: string | null
          user_id: string
        }
        Insert: {
          account_id: string
          amount: number
          available_at?: string | null
          created_at?: string
          currency: string
          description?: string | null
          entry_type: Database["public"]["Enums"]["wallet_entry_type_enum"]
          id?: string
          metadata?: Json
          order_id?: string | null
          status?: Database["public"]["Enums"]["wallet_entry_status_enum"]
          topup_id?: string | null
          user_id: string
        }
        Update: {
          account_id?: string
          amount?: number
          available_at?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          entry_type?: Database["public"]["Enums"]["wallet_entry_type_enum"]
          id?: string
          metadata?: Json
          order_id?: string | null
          status?: Database["public"]["Enums"]["wallet_entry_status_enum"]
          topup_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallet_ledger_entries_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "wallet_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wallet_ledger_entries_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "customer_order_history_view"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "wallet_ledger_entries_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "customer_orders_view"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "wallet_ledger_entries_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wallet_ledger_entries_topup_id_fkey"
            columns: ["topup_id"]
            isOneToOne: false
            referencedRelation: "wallet_topups"
            referencedColumns: ["id"]
          },
        ]
      }
      wallet_topups: {
        Row: {
          amount: number
          checkout_url: string | null
          created_at: string
          currency: string
          gateway: string | null
          gateway_transaction_id: string | null
          id: string
          metadata: Json
          paid_at: string | null
          provider: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          checkout_url?: string | null
          created_at?: string
          currency: string
          gateway?: string | null
          gateway_transaction_id?: string | null
          id?: string
          metadata?: Json
          paid_at?: string | null
          provider?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          checkout_url?: string | null
          created_at?: string
          currency?: string
          gateway?: string | null
          gateway_transaction_id?: string | null
          id?: string
          metadata?: Json
          paid_at?: string | null
          provider?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      warehouse_inventory: {
        Row: {
          available_quantity: number
          average_cost: number | null
          average_daily_sales: number | null
          backordered_quantity: number | null
          committed_quantity: number
          created_at: string | null
          holding_cost_per_day: number | null
          id: string
          in_transit_quantity: number | null
          is_active: boolean | null
          landed_cost: number | null
          last_counted_at: string | null
          last_restocked_at: string | null
          listing_id: string
          maximum_stock_level: number | null
          metadata: Json | null
          minimum_stock_level: number | null
          next_count_date: string | null
          next_restock_date: string | null
          reorder_point: number | null
          reserved_quantity: number
          safety_stock: number | null
          status: Database["public"]["Enums"]["inventory_status_enum"] | null
          stock_cover_days: number | null
          storage_location: Json | null
          updated_at: string | null
          variant_id: string | null
          warehouse_id: string
        }
        Insert: {
          available_quantity?: number
          average_cost?: number | null
          average_daily_sales?: number | null
          backordered_quantity?: number | null
          committed_quantity?: number
          created_at?: string | null
          holding_cost_per_day?: number | null
          id?: string
          in_transit_quantity?: number | null
          is_active?: boolean | null
          landed_cost?: number | null
          last_counted_at?: string | null
          last_restocked_at?: string | null
          listing_id: string
          maximum_stock_level?: number | null
          metadata?: Json | null
          minimum_stock_level?: number | null
          next_count_date?: string | null
          next_restock_date?: string | null
          reorder_point?: number | null
          reserved_quantity?: number
          safety_stock?: number | null
          status?: Database["public"]["Enums"]["inventory_status_enum"] | null
          stock_cover_days?: number | null
          storage_location?: Json | null
          updated_at?: string | null
          variant_id?: string | null
          warehouse_id: string
        }
        Update: {
          available_quantity?: number
          average_cost?: number | null
          average_daily_sales?: number | null
          backordered_quantity?: number | null
          committed_quantity?: number
          created_at?: string | null
          holding_cost_per_day?: number | null
          id?: string
          in_transit_quantity?: number | null
          is_active?: boolean | null
          landed_cost?: number | null
          last_counted_at?: string | null
          last_restocked_at?: string | null
          listing_id?: string
          maximum_stock_level?: number | null
          metadata?: Json | null
          minimum_stock_level?: number | null
          next_count_date?: string | null
          next_restock_date?: string | null
          reorder_point?: number | null
          reserved_quantity?: number
          safety_stock?: number | null
          status?: Database["public"]["Enums"]["inventory_status_enum"] | null
          stock_cover_days?: number | null
          storage_location?: Json | null
          updated_at?: string | null
          variant_id?: string | null
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "warehouse_inventory_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouse_availability"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warehouse_inventory_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      warehouse_performance_logs: {
        Row: {
          average_pack_time_minutes: number | null
          average_pick_time_minutes: number | null
          average_processing_time_hours: number | null
          created_at: string | null
          fulfillment_accuracy_rate: number | null
          id: string
          issues_reported: number | null
          issues_resolved: number | null
          log_date: string
          orders_cancelled: number | null
          orders_fulfilled: number | null
          orders_pending: number | null
          packing_accuracy_rate: number | null
          picking_accuracy_rate: number | null
          returns_processed: number | null
          returns_received: number | null
          total_orders_received: number | null
          warehouse_id: string
        }
        Insert: {
          average_pack_time_minutes?: number | null
          average_pick_time_minutes?: number | null
          average_processing_time_hours?: number | null
          created_at?: string | null
          fulfillment_accuracy_rate?: number | null
          id?: string
          issues_reported?: number | null
          issues_resolved?: number | null
          log_date?: string
          orders_cancelled?: number | null
          orders_fulfilled?: number | null
          orders_pending?: number | null
          packing_accuracy_rate?: number | null
          picking_accuracy_rate?: number | null
          returns_processed?: number | null
          returns_received?: number | null
          total_orders_received?: number | null
          warehouse_id: string
        }
        Update: {
          average_pack_time_minutes?: number | null
          average_pick_time_minutes?: number | null
          average_processing_time_hours?: number | null
          created_at?: string | null
          fulfillment_accuracy_rate?: number | null
          id?: string
          issues_reported?: number | null
          issues_resolved?: number | null
          log_date?: string
          orders_cancelled?: number | null
          orders_fulfilled?: number | null
          orders_pending?: number | null
          packing_accuracy_rate?: number | null
          picking_accuracy_rate?: number | null
          returns_processed?: number | null
          returns_received?: number | null
          total_orders_received?: number | null
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "performance_logs_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouse_availability"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "performance_logs_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      warehouse_shipping_zones: {
        Row: {
          cities: string[] | null
          countries: string[] | null
          created_at: string | null
          cutoff_time: string | null
          description: string | null
          estimated_delivery_days: Json | null
          id: string
          is_active: boolean | null
          pin_codes: string[] | null
          service_available_days: number[] | null
          states: string[] | null
          updated_at: string | null
          warehouse_id: string
          zone_code: string
          zone_name: string
        }
        Insert: {
          cities?: string[] | null
          countries?: string[] | null
          created_at?: string | null
          cutoff_time?: string | null
          description?: string | null
          estimated_delivery_days?: Json | null
          id?: string
          is_active?: boolean | null
          pin_codes?: string[] | null
          service_available_days?: number[] | null
          states?: string[] | null
          updated_at?: string | null
          warehouse_id: string
          zone_code: string
          zone_name: string
        }
        Update: {
          cities?: string[] | null
          countries?: string[] | null
          created_at?: string | null
          cutoff_time?: string | null
          description?: string | null
          estimated_delivery_days?: Json | null
          id?: string
          is_active?: boolean | null
          pin_codes?: string[] | null
          service_available_days?: number[] | null
          states?: string[] | null
          updated_at?: string | null
          warehouse_id?: string
          zone_code?: string
          zone_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "warehouse_zones_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouse_availability"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warehouse_zones_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      warehouses: {
        Row: {
          address_line_1: string
          address_line_2: string | null
          area: string | null
          average_processing_hours: number | null
          city: string
          contact_person: string
          country: string | null
          created_at: string | null
          current_daily_order_count: number | null
          cutoff_time: string | null
          fulfillment_success_rate: number | null
          full_address: string | null
          gst_certificate_url: string | null
          gst_number: string | null
          id: string
          is_default: boolean | null
          is_gst_registered: boolean | null
          is_online: boolean | null
          is_primary: boolean | null
          is_returns_center: boolean | null
          landmark: string | null
          last_performance_update: string | null
          latitude: number | null
          longitude: number | null
          max_daily_orders: number | null
          metadata: Json | null
          mobile_number: string
          operational_hours: Json | null
          pin_code: string
          services: Json | null
          shipping_zones: Json | null
          shop_id: string
          state: string
          status: Database["public"]["Enums"]["warehouse_status_enum"] | null
          supported_carriers: Json | null
          total_capacity_sqft: number | null
          updated_at: string | null
          utilized_capacity_sqft: number | null
          warehouse_code: string
          warehouse_name: string
          warehouse_type:
            | Database["public"]["Enums"]["warehouse_type_enum"]
            | null
        }
        Insert: {
          address_line_1: string
          address_line_2?: string | null
          area?: string | null
          average_processing_hours?: number | null
          city: string
          contact_person: string
          country?: string | null
          created_at?: string | null
          current_daily_order_count?: number | null
          cutoff_time?: string | null
          fulfillment_success_rate?: number | null
          full_address?: string | null
          gst_certificate_url?: string | null
          gst_number?: string | null
          id?: string
          is_default?: boolean | null
          is_gst_registered?: boolean | null
          is_online?: boolean | null
          is_primary?: boolean | null
          is_returns_center?: boolean | null
          landmark?: string | null
          last_performance_update?: string | null
          latitude?: number | null
          longitude?: number | null
          max_daily_orders?: number | null
          metadata?: Json | null
          mobile_number: string
          operational_hours?: Json | null
          pin_code: string
          services?: Json | null
          shipping_zones?: Json | null
          shop_id: string
          state: string
          status?: Database["public"]["Enums"]["warehouse_status_enum"] | null
          supported_carriers?: Json | null
          total_capacity_sqft?: number | null
          updated_at?: string | null
          utilized_capacity_sqft?: number | null
          warehouse_code: string
          warehouse_name: string
          warehouse_type?:
            | Database["public"]["Enums"]["warehouse_type_enum"]
            | null
        }
        Update: {
          address_line_1?: string
          address_line_2?: string | null
          area?: string | null
          average_processing_hours?: number | null
          city?: string
          contact_person?: string
          country?: string | null
          created_at?: string | null
          current_daily_order_count?: number | null
          cutoff_time?: string | null
          fulfillment_success_rate?: number | null
          full_address?: string | null
          gst_certificate_url?: string | null
          gst_number?: string | null
          id?: string
          is_default?: boolean | null
          is_gst_registered?: boolean | null
          is_online?: boolean | null
          is_primary?: boolean | null
          is_returns_center?: boolean | null
          landmark?: string | null
          last_performance_update?: string | null
          latitude?: number | null
          longitude?: number | null
          max_daily_orders?: number | null
          metadata?: Json | null
          mobile_number?: string
          operational_hours?: Json | null
          pin_code?: string
          services?: Json | null
          shipping_zones?: Json | null
          shop_id?: string
          state?: string
          status?: Database["public"]["Enums"]["warehouse_status_enum"] | null
          supported_carriers?: Json | null
          total_capacity_sqft?: number | null
          updated_at?: string | null
          utilized_capacity_sqft?: number | null
          warehouse_code?: string
          warehouse_name?: string
          warehouse_type?:
            | Database["public"]["Enums"]["warehouse_type_enum"]
            | null
        }
        Relationships: [
          {
            foreignKeyName: "warehouses_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "active_listings_view"
            referencedColumns: ["shop_id"]
          },
          {
            foreignKeyName: "warehouses_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "payment_analytics"
            referencedColumns: ["shop_id"]
          },
          {
            foreignKeyName: "warehouses_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shop_listings_summary"
            referencedColumns: ["shop_id"]
          },
          {
            foreignKeyName: "warehouses_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      webrtc_signals: {
        Row: {
          created_at: string | null
          id: string
          room_id: string
          signal_data: Json
          signal_type: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          room_id: string
          signal_data: Json
          signal_type: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          room_id?: string
          signal_data?: Json
          signal_type?: string
          user_id?: string | null
        }
        Relationships: []
      }
      wishlist_collections: {
        Row: {
          created_at: string
          id: string
          name: string
          share_enabled_at: string | null
          share_token: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          share_enabled_at?: string | null
          share_token?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          share_enabled_at?: string | null
          share_token?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wishlist_collections_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      wishlists: {
        Row: {
          collection_id: string | null
          created_at: string
          id: string
          listing_id: string
          user_id: string
        }
        Insert: {
          collection_id?: string | null
          created_at?: string
          id?: string
          listing_id: string
          user_id: string
        }
        Update: {
          collection_id?: string | null
          created_at?: string
          id?: string
          listing_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wishlists_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "wishlist_collections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wishlists_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "active_listings_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wishlists_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "active_listings_with_shop"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wishlists_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listing_details_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wishlists_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      active_listings_view: {
        Row: {
          booking_duration_minutes: number | null
          created_at: string | null
          description: string | null
          digital_file_size: number | null
          digital_file_type: string | null
          dimensions: Json | null
          download_limit: number | null
          id: string | null
          image_count: number | null
          is_featured: boolean | null
          is_online: boolean | null
          listing_type: Database["public"]["Enums"]["listing_type_enum"] | null
          logo_url: string | null
          max_attendees: number | null
          price: number | null
          primary_image_url: string | null
          published_at: string | null
          quantity: number | null
          requires_approval: boolean | null
          shipping_required: boolean | null
          shop_currency: string | null
          shop_description: string | null
          shop_id: string | null
          shop_name: string | null
          shop_verified: boolean | null
          sku: string | null
          slug: string | null
          stock: number | null
          tags: string[] | null
          title: string | null
          variation_count: number | null
          weight: number | null
        }
        Relationships: []
      }
      active_listings_with_shop: {
        Row: {
          average_rating: number | null
          created_at: string | null
          id: string | null
          listing_type: Database["public"]["Enums"]["listing_type_enum"] | null
          logo_url: string | null
          price: number | null
          primary_image_url: string | null
          shop_currency: string | null
          shop_id: string | null
          shop_name: string | null
          slug: string | null
          title: string | null
          total_reviews: number | null
          verified: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "listings_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "active_listings_view"
            referencedColumns: ["shop_id"]
          },
          {
            foreignKeyName: "listings_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "payment_analytics"
            referencedColumns: ["shop_id"]
          },
          {
            foreignKeyName: "listings_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shop_listings_summary"
            referencedColumns: ["shop_id"]
          },
          {
            foreignKeyName: "listings_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      categories_with_counts: {
        Row: {
          category: string | null
          category_icon: string | null
          category_id: string | null
          category_image_url: string | null
          level: number | null
          position: number | null
          product_count: number | null
          seo_name: string | null
        }
        Relationships: []
      }
      cms_sitemap_feed: {
        Row: {
          changefreq: string | null
          last_modified: string | null
          path: string | null
          priority: number | null
        }
        Relationships: []
      }
      comments_with_stats: {
        Row: {
          author_avatar: string | null
          author_headline: string | null
          author_name: string | null
          content: string | null
          created_at: string | null
          id: string | null
          is_deleted: boolean | null
          is_edited: boolean | null
          like_count: number | null
          media_urls: string[] | null
          parent_comment_id: string | null
          post_id: string | null
          reply_count: number | null
          thread_level: number | null
          total_likes: number | null
          updated_at: string | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "comments_parent_comment_id_fkey"
            columns: ["parent_comment_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_parent_comment_id_fkey"
            columns: ["parent_comment_id"]
            isOneToOne: false
            referencedRelation: "comments_with_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts_with_stats"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_order_history_view: {
        Row: {
          cancelled_items: number | null
          created_at: string | null
          currency: string | null
          customer_id: string | null
          delivered_at: string | null
          delivered_items: number | null
          delivery_city: string | null
          delivery_state: string | null
          item_count: number | null
          order_id: string | null
          order_number: string | null
          order_status: Database["public"]["Enums"]["order_status_enum"] | null
          payment_mode: Database["public"]["Enums"]["payment_mode_enum"] | null
          payment_status:
            | Database["public"]["Enums"]["payment_status_enum"]
            | null
          processing_items: number | null
          progress_percentage: number | null
          returned_items: number | null
          shipped_items: number | null
          shop_names: string | null
          total_amount: number | null
          total_quantity: number | null
          tracking_numbers: string | null
          unique_vendors: number | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_user_id_fkey1"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_orders_view: {
        Row: {
          cancelled_items_count: number | null
          carrier_names: string | null
          completed_at: string | null
          confirmed_at: string | null
          currency: string | null
          customer_avatar: string | null
          customer_email: string | null
          customer_id: string | null
          customer_name: string | null
          customer_notes: string | null
          customer_phone: string | null
          delivered_at: string | null
          delivered_items_count: number | null
          delivery_count: number | null
          discount_amount: number | null
          estimated_delivery_date: string | null
          order_created_at: string | null
          order_id: string | null
          order_number: string | null
          order_status: Database["public"]["Enums"]["order_status_enum"] | null
          order_updated_at: string | null
          payment_mode: Database["public"]["Enums"]["payment_mode_enum"] | null
          payment_required: boolean | null
          payment_status:
            | Database["public"]["Enums"]["payment_status_enum"]
            | null
          requested_delivery_date: string | null
          shipped_at: string | null
          shipped_items_count: number | null
          shipping_amount: number | null
          shipping_city: string | null
          shipping_country: string | null
          shipping_customer_name: string | null
          shipping_phone: string | null
          shipping_postal_code: string | null
          shipping_state: string | null
          shipping_street: string | null
          special_instructions: string | null
          subtotal_amount: number | null
          tax_amount: number | null
          total_amount: number | null
          total_items: number | null
          total_quantity: number | null
          tracking_numbers: string | null
          transaction_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_user_id_fkey1"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      listing_details_view: {
        Row: {
          attributes: Json | null
          booking_duration_minutes: number | null
          created_at: string | null
          description: string | null
          digital_file_size: number | null
          digital_file_type: string | null
          digital_file_url: string | null
          dimensions: Json | null
          download_limit: number | null
          id: string | null
          images: Json | null
          is_active: boolean | null
          is_featured: boolean | null
          is_online: boolean | null
          listing_metadata: Json | null
          listing_status:
            | Database["public"]["Enums"]["listing_status_enum"]
            | null
          listing_type: Database["public"]["Enums"]["listing_type_enum"] | null
          location_id: string | null
          logo_url: string | null
          materials: Json | null
          max_attendees: number | null
          meeting_url: string | null
          meta_description: string | null
          meta_title: string | null
          price: number | null
          published_at: string | null
          quantity: number | null
          requires_approval: boolean | null
          sections: Json | null
          shipping_required: boolean | null
          shop_currency: string | null
          shop_description: string | null
          shop_hours: Json | null
          shop_id: string | null
          shop_name: string | null
          shop_verified: boolean | null
          sku: string | null
          slug: string | null
          social_links: Json | null
          stock: number | null
          tags: string[] | null
          title: string | null
          updated_at: string | null
          variations: Json | null
          weight: number | null
        }
        Relationships: [
          {
            foreignKeyName: "listings_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "addresses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listings_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "shop_addresses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listings_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "active_listings_view"
            referencedColumns: ["shop_id"]
          },
          {
            foreignKeyName: "listings_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "payment_analytics"
            referencedColumns: ["shop_id"]
          },
          {
            foreignKeyName: "listings_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shop_listings_summary"
            referencedColumns: ["shop_id"]
          },
          {
            foreignKeyName: "listings_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      listing_review_replies_public_view: {
        Row: {
          created_at: string | null
          id: string | null
          is_pinned: boolean | null
          is_vendor_reply: boolean | null
          parent_replier_username: string | null
          parent_reply_id: string | null
          parent_reply_text: string | null
          replier_avatar: string | null
          replier_id: string | null
          replier_name: string | null
          replier_username: string | null
          reply_text: string | null
          review_id: string | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "listing_review_replies_parent_reply_id_fkey"
            columns: ["parent_reply_id"]
            isOneToOne: false
            referencedRelation: "listing_review_replies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_review_replies_parent_reply_id_fkey"
            columns: ["parent_reply_id"]
            isOneToOne: false
            referencedRelation: "listing_review_replies_public_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_review_replies_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "listing_reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_statistics: {
        Row: {
          avg_price: number | null
          digital_listings: number | null
          in_stock_physical_listings: number | null
          max_price: number | null
          min_price: number | null
          new_listings_this_month: number | null
          new_listings_this_week: number | null
          out_of_stock_physical_listings: number | null
          physical_listings: number | null
          service_listings: number | null
          shops_with_listings: number | null
          total_active_listings: number | null
          total_featured_listings: number | null
          total_physical_stock: number | null
        }
        Relationships: []
      }
      notification_analytics: {
        Row: {
          category: string | null
          click_count: number | null
          click_rate: number | null
          date: string | null
          platform: string | null
          read_count: number | null
          read_rate: number | null
          total_notifications: number | null
          type: string | null
        }
        Relationships: []
      }
      payment_analytics: {
        Row: {
          failed_transactions: number | null
          month: string | null
          provider: Database["public"]["Enums"]["payment_provider_enum"] | null
          shop_id: string | null
          shop_name: string | null
          success_rate: number | null
          successful_transactions: number | null
          total_amount: number | null
          total_transactions: number | null
        }
        Relationships: []
      }
      posts_with_stats: {
        Row: {
          allow_comments: boolean | null
          allow_reactions: boolean | null
          author_avatar: string | null
          author_headline: string | null
          author_name: string | null
          author_verified: boolean | null
          celebrate_count: number | null
          celebration_data: Json | null
          content: string | null
          content_warning: string | null
          created_at: string | null
          engagement_score: number | null
          event_description: string | null
          event_end_time: string | null
          event_location: string | null
          event_rsvp_enabled: boolean | null
          event_start_time: string | null
          event_title: string | null
          funny_count: number | null
          id: string | null
          image_url: string | null
          image_urls: string[] | null
          insightful_count: number | null
          is_deleted: boolean | null
          is_pinned: boolean | null
          language: string | null
          like_count: number | null
          link_preview_data: Json | null
          love_count: number | null
          media_urls: string[] | null
          mentions: string[] | null
          original_post_id: string | null
          post_data: Json | null
          post_type: string | null
          published_at: string | null
          repost_comment: string | null
          repost_count: number | null
          support_count: number | null
          tags: string[] | null
          total_comments: number | null
          total_reactions: number | null
          total_views: number | null
          unique_views: number | null
          updated_at: string | null
          user_id: string | null
          video_url: string | null
          video_urls: string[] | null
          visibility: string | null
        }
        Relationships: [
          {
            foreignKeyName: "posts_original_post_id_fkey"
            columns: ["original_post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posts_original_post_id_fkey"
            columns: ["original_post_id"]
            isOneToOne: false
            referencedRelation: "posts_with_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posts_user_id_fkey_profile"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      program_comments_with_stats: {
        Row: {
          comment_text: string | null
          created_at: string | null
          deleted_at: string | null
          edited_at: string | null
          id: string | null
          is_edited: boolean | null
          parent_id: string | null
          program_id: string | null
          reaction_summary: Json | null
          reply_count: number | null
          total_reactions: number | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "program_comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "program_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "program_comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "program_comments_with_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "program_comments_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "program_reactions_summary"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "program_comments_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "program_comments_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs_seo_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "program_comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      program_reactions_summary: {
        Row: {
          like_count: number | null
          program_id: string | null
          reaction_summary: Json | null
          total_reactions: number | null
        }
        Relationships: []
      }
      programs_seo_view: {
        Row: {
          audio_url: string | null
          canonical_url: string | null
          category: string | null
          created_at: string | null
          description: string | null
          duration: string | null
          external_author_id: string | null
          featured: boolean | null
          full_url: string | null
          id: string | null
          image_url: string | null
          language: string | null
          like_count: number | null
          media_type: string | null
          meta_description: string | null
          meta_title: string | null
          open_graph_description: string | null
          open_graph_image: string | null
          open_graph_title: string | null
          published_at: string | null
          robots_follow: boolean | null
          robots_index: boolean | null
          seo_description: string | null
          seo_keywords: string[] | null
          seo_priority: number | null
          seo_slug: string | null
          seo_title: string | null
          tags: string[] | null
          title: string | null
          twitter_card_type: string | null
          twitter_description: string | null
          twitter_image: string | null
          twitter_title: string | null
          updated_at: string | null
          video_url: string | null
          view_count: number | null
        }
        Insert: {
          audio_url?: string | null
          canonical_url?: string | null
          category?: string | null
          created_at?: string | null
          description?: string | null
          duration?: string | null
          external_author_id?: string | null
          featured?: boolean | null
          full_url?: never
          id?: string | null
          image_url?: string | null
          language?: string | null
          like_count?: number | null
          media_type?: string | null
          meta_description?: string | null
          meta_title?: string | null
          open_graph_description?: string | null
          open_graph_image?: string | null
          open_graph_title?: string | null
          published_at?: string | null
          robots_follow?: boolean | null
          robots_index?: boolean | null
          seo_description?: string | null
          seo_keywords?: string[] | null
          seo_priority?: number | null
          seo_slug?: string | null
          seo_title?: string | null
          tags?: string[] | null
          title?: string | null
          twitter_card_type?: string | null
          twitter_description?: string | null
          twitter_image?: string | null
          twitter_title?: string | null
          updated_at?: string | null
          video_url?: string | null
          view_count?: number | null
        }
        Update: {
          audio_url?: string | null
          canonical_url?: string | null
          category?: string | null
          created_at?: string | null
          description?: string | null
          duration?: string | null
          external_author_id?: string | null
          featured?: boolean | null
          full_url?: never
          id?: string | null
          image_url?: string | null
          language?: string | null
          like_count?: number | null
          media_type?: string | null
          meta_description?: string | null
          meta_title?: string | null
          open_graph_description?: string | null
          open_graph_image?: string | null
          open_graph_title?: string | null
          published_at?: string | null
          robots_follow?: boolean | null
          robots_index?: boolean | null
          seo_description?: string | null
          seo_keywords?: string[] | null
          seo_priority?: number | null
          seo_slug?: string | null
          seo_title?: string | null
          tags?: string[] | null
          title?: string | null
          twitter_card_type?: string | null
          twitter_description?: string | null
          twitter_image?: string | null
          twitter_title?: string | null
          updated_at?: string | null
          video_url?: string | null
          view_count?: number | null
        }
        Relationships: []
      }
      shop_addresses: {
        Row: {
          city: string | null
          country: string | null
          created_at: string | null
          id: string | null
          latitude: number | null
          longitude: number | null
          postal_code: string | null
          state: string | null
          updated_at: string | null
        }
        Insert: {
          city?: string | null
          country?: string | null
          created_at?: string | null
          id?: string | null
          latitude?: never
          longitude?: never
          postal_code?: string | null
          state?: string | null
          updated_at?: string | null
        }
        Update: {
          city?: string | null
          country?: string | null
          created_at?: string | null
          id?: string | null
          latitude?: never
          longitude?: never
          postal_code?: string | null
          state?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      shop_listings_summary: {
        Row: {
          active_listings: number | null
          avg_price: number | null
          digital_listings: number | null
          featured_listings: number | null
          first_listing_date: string | null
          is_active: boolean | null
          latest_listing_date: string | null
          max_price: number | null
          min_price: number | null
          physical_listings: number | null
          published_listings: number | null
          service_listings: number | null
          shop_active: boolean | null
          shop_id: string | null
          shop_name: string | null
          shop_verified: boolean | null
          total_active_listings: number | null
          total_listings: number | null
        }
        Relationships: []
      }
      user_notification_summary: {
        Row: {
          last_notification_at: string | null
          read_count: number | null
          recipient_id: string | null
          total_notifications: number | null
          unread_count: number | null
          urgent_count: number | null
        }
        Relationships: []
      }
      vendor_customer_order_history: {
        Row: {
          average_order_value: number | null
          cancelled_orders: number | null
          completed_orders: number | null
          customer_name: string | null
          first_order_date: string | null
          last_order_date: string | null
          total_orders: number | null
          total_spent: number | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_user_id_fkey1"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_order_analytics: {
        Row: {
          average_order_value: number | null
          order_count: number | null
          order_date: string | null
          order_status: Database["public"]["Enums"]["order_status_enum"] | null
          total_discounts: number | null
          total_revenue: number | null
          total_shipping: number | null
          total_subtotal: number | null
          total_tax: number | null
        }
        Relationships: []
      }
      vendor_regional_sales: {
        Row: {
          average_order_value: number | null
          cod_orders: number | null
          cod_percentage: number | null
          delivery_country: string | null
          delivery_region: string | null
          shop_id: string | null
          total_orders: number | null
          total_revenue: number | null
          total_units_sold: number | null
          unique_customers: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_analytics_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "active_listings_view"
            referencedColumns: ["shop_id"]
          },
          {
            foreignKeyName: "sales_analytics_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "payment_analytics"
            referencedColumns: ["shop_id"]
          },
          {
            foreignKeyName: "sales_analytics_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shop_listings_summary"
            referencedColumns: ["shop_id"]
          },
          {
            foreignKeyName: "sales_analytics_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_sales_analytics: {
        Row: {
          average_order_value: number | null
          cod_orders: number | null
          cod_percentage: number | null
          express_deliveries: number | null
          online_payment_orders: number | null
          refund_rate_percentage: number | null
          regions_served: number | null
          return_rate_percentage: number | null
          sale_date: string | null
          sale_month: string | null
          sale_week: string | null
          sale_year: string | null
          shop_id: string | null
          shop_name: string | null
          standard_deliveries: number | null
          top_selling_category: string | null
          top_selling_listing_id: string | null
          top_selling_region: string | null
          total_discounts_given: number | null
          total_item_revenue: number | null
          total_orders: number | null
          total_refund_amount: number | null
          total_refunds: number | null
          total_returns: number | null
          total_revenue: number | null
          total_shipping_revenue: number | null
          total_tax_collected: number | null
          total_units_sold: number | null
          unique_customers: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_analytics_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "active_listings_view"
            referencedColumns: ["shop_id"]
          },
          {
            foreignKeyName: "sales_analytics_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "payment_analytics"
            referencedColumns: ["shop_id"]
          },
          {
            foreignKeyName: "sales_analytics_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shop_listings_summary"
            referencedColumns: ["shop_id"]
          },
          {
            foreignKeyName: "sales_analytics_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_top_products: {
        Row: {
          average_order_value: number | null
          listing_id: string | null
          product_category: string | null
          product_title: string | null
          return_rate_percentage: number | null
          shop_id: string | null
          total_orders: number | null
          total_refunds: number | null
          total_returns: number | null
          total_revenue: number | null
          total_units_sold: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_analytics_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "active_listings_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_analytics_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "active_listings_with_shop"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_analytics_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listing_details_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_analytics_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_analytics_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "active_listings_view"
            referencedColumns: ["shop_id"]
          },
          {
            foreignKeyName: "sales_analytics_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "payment_analytics"
            referencedColumns: ["shop_id"]
          },
          {
            foreignKeyName: "sales_analytics_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shop_listings_summary"
            referencedColumns: ["shop_id"]
          },
          {
            foreignKeyName: "sales_analytics_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      warehouse_availability: {
        Row: {
          can_accept_orders: boolean | null
          city: string | null
          current_daily_order_count: number | null
          current_processing_time: number | null
          fulfillment_success_rate: number | null
          id: string | null
          is_online: boolean | null
          latitude: number | null
          longitude: number | null
          max_daily_orders: number | null
          pin_code: string | null
          state: string | null
          status: Database["public"]["Enums"]["warehouse_status_enum"] | null
          warehouse_code: string | null
          warehouse_name: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      assign_meeting_co_host: {
        Args: { meeting_id_input: string; target_user_id_input: string }
        Returns: undefined
      }
      cancel_meeting_secure: {
        Args: { meeting_id_input: string }
        Returns: undefined
      }
      end_meeting_secure: {
        Args: { meeting_id_input: string }
        Returns: undefined
      }
      moderate_meeting_participants: {
        Args: {
          action_input: string
          meeting_id_input: string
          target_user_id_input?: string | null
        }
        Returns: string
      }
      remove_meeting_co_host: {
        Args: { meeting_id_input: string; target_user_id_input: string }
        Returns: undefined
      }
      review_meeting_participant: {
        Args: { decision_input: string; participant_id_input: string }
        Returns: undefined
      }
      set_meeting_locked: {
        Args: { locked_input: boolean; meeting_id_input: string }
        Returns: Database["public"]["Tables"]["meeting_moderation_settings"]["Row"]
      }
      start_meeting_secure: {
        Args: { meeting_id_input: string }
        Returns: undefined
      }
      transfer_meeting_host: {
        Args: { meeting_id_input: string; target_user_id_input: string }
        Returns: undefined
      }
      update_meeting_invitees_secure: {
        Args: { invitees_input: Json; meeting_id_input: string }
        Returns: undefined
      }
      update_meeting_schedule_secure: {
        Args: {
          meeting_id_input: string
          title_input: string
          description_input?: string | null
          scheduled_at_input?: string | null
          scheduled_end_at_input?: string | null
          time_zone_input?: string | null
          max_participants_input?: number | null
          is_recurring_input?: boolean | null
          repeat_input?: string | null
          security_settings_input?: Json | null
          meeting_options_input?: Json | null
          invitees_input?: Json | null
          convert_to_scheduled_input?: boolean | null
        }
        Returns: Database["public"]["Tables"]["meetings"]["Row"]
      }
      join_meeting_participant: {
        Args: { meeting_id_input: string; session_id_input: string }
        Returns: Database["public"]["Tables"]["meeting_participants"]["Row"]
      }
      leave_meeting_participant: {
        Args: { meeting_id_input: string; session_id_input: string }
        Returns: undefined
      }
      set_meeting_participant_display_name: {
        Args: {
          display_name_input: string
          meeting_id_input: string
          session_id_input: string
        }
        Returns: undefined
      }
      update_meeting_participant_media: {
        Args: {
          is_muted_input?: boolean | null
          is_video_off_input?: boolean | null
          meeting_id_input: string
          session_id_input: string
        }
        Returns: undefined
      }
      _cancel_unpaid_checkout_group: {
        Args: { p_group_id: string }
        Returns: Json
      }
      _confirm_order_return_received: {
        Args: { p_actor?: string; p_note?: string; p_order_item_id: string }
        Returns: Json
      }
      _enqueue_gateway_refund: {
        Args: { p_refund_id: string }
        Returns: undefined
      }
      _item_delivered_at: { Args: { p_order_item_id: string }; Returns: string }
      _marketplace_append_issue_event: {
        Args: {
          p_actor_id: string
          p_event_type: string
          p_issue_id: string
          p_metadata?: Json
          p_note?: string
        }
        Returns: undefined
      }
      _marketplace_is_admin: { Args: { p_user_id: string }; Returns: boolean }
      _resolve_item_return_policy: {
        Args: { p_order_item_id: string }
        Returns: {
          accepts_exchanges: boolean
          accepts_refunds: boolean
          accepts_returns: boolean
          return_window_days: number
        }[]
      }
      _restock_cancelled_order_items: {
        Args: { p_order_id: string; p_order_item_id?: string }
        Returns: undefined
      }
      _restore_checkout_cart: {
        Args: { p_cart_id: string; p_group_id: string; p_order_ids: string[] }
        Returns: undefined
      }
      add_bundle_to_cart: {
        Args: { p_bundle_id: string; p_cart_id: string; p_quantity?: number }
        Returns: {
          cart_id: string
          created_at: string
          id: string
          image_url: string | null
          item_metadata: Json
          listing_id: string
          quantity: number
          saved_for_later: boolean
          shop_id: string
          shop_name: string
          title: string
          total_price: number | null
          unit_price: number
          updated_at: string
          variant_id: string | null
          variant_name: string | null
          variant_sku: string | null
          variant_value: string | null
        }
        SetofOptions: {
          from: "*"
          to: "cart_items"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      add_group_participants: {
        Args: { p_conversation_id: string; p_user_ids: string[] }
        Returns: undefined
      }
      add_to_cart: {
        Args: {
          p_cart_id: string
          p_listing_id: string
          p_quantity?: number
          p_variant_id?: string
        }
        Returns: {
          cart_id: string
          created_at: string
          id: string
          image_url: string | null
          item_metadata: Json
          listing_id: string
          quantity: number
          saved_for_later: boolean
          shop_id: string
          shop_name: string
          title: string
          total_price: number | null
          unit_price: number
          updated_at: string
          variant_id: string | null
          variant_name: string | null
          variant_sku: string | null
          variant_value: string | null
        }
        SetofOptions: {
          from: "*"
          to: "cart_items"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_search_listings: {
        Args: {
          p_is_featured?: boolean
          p_limit?: number
          p_listing_type?: Database["public"]["Enums"]["listing_type_enum"]
          p_max_price?: number
          p_min_price?: number
          p_offset?: number
          p_search_term?: string
          p_shop_id?: string
          p_status?: string
          p_tags?: string[]
        }
        Returns: {
          category: string
          created_at: string
          description: string
          id: string
          is_active: boolean
          is_featured: boolean
          listing_status: Database["public"]["Enums"]["listing_status_enum"]
          listing_type: Database["public"]["Enums"]["listing_type_enum"]
          price: number
          primary_image_url: string
          shop_currency: string
          shop_id: string
          shop_name: string
          shop_verified: boolean
          sku: string
          slug: string
          stock: number
          title: string
          updated_at: string
        }[]
      }
      app_public_base_url: { Args: never; Returns: string }
      apply_discount_to_cart: {
        Args: {
          p_cart_id: string
          p_discount_amount?: number
          p_discount_profile_id: string
        }
        Returns: {
          applied_discount_id: string | null
          applied_discount_name: string | null
          applied_discount_type: string | null
          applied_discount_value: number | null
          cart_metadata: Json
          converted_at: string | null
          created_at: string
          currency: string
          discount_amount: number
          expires_at: string
          id: string
          items_subtotal: number
          last_activity_at: string
          session_id: string | null
          status: Database["public"]["Enums"]["cart_status_enum"]
          total_amount: number
          updated_at: string
          user_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "carts"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      approve_qr_login_challenge: {
        Args: { p_device_code: string }
        Returns: Json
      }
      assign_categories_to_listing: {
        Args: { p_categories: Json; p_listing_id: string; p_user_id: string }
        Returns: Json
      }
      assign_return_tracking: {
        Args: {
          p_courier_slug?: string
          p_custom_tracking_url?: string
          p_order_item_id: string
          p_return_shipping_mode?: string
          p_tracking_number: string
        }
        Returns: Json
      }
      atomic_marketplace_checkout: {
        Args: {
          p_billing_address_id?: string
          p_cart_id: string
          p_cart_item_ids: string[]
          p_customer_amounts_by_shop?: Json
          p_customer_currency?: string
          p_gift_shop_ids?: string[]
          p_idempotency_key?: string
          p_notes_by_shop?: Json
          p_payment_mode?: string
          p_shipping_address_id: string
        }
        Returns: Json
      }
      auto_assign_chat_agent: {
        Args: { category?: string; priority?: string; ticket_id: string }
        Returns: string
      }
      auto_assign_support_conversation: {
        Args: { p_conversation_id: string }
        Returns: undefined
      }
      backfill_program_seo_data: { Args: never; Returns: undefined }
      buyer_unlock_with_points: { Args: never; Returns: boolean }
      bytea_to_text: { Args: { data: string }; Returns: string }
      calculate_order_tax: {
        Args: { p_order_id: string; p_shipping_address_id: string }
        Returns: number
      }
      calculate_order_totals: {
        Args: { p_cart_items: Json; p_order_discounts?: Json }
        Returns: Json
      }
      calculate_popularity_score: {
        Args: {
          click_count: number
          conversion_count: number
          created_at: string
          view_count: number
        }
        Returns: number
      }
      calculate_profile_completion: {
        Args: { profile_id: string }
        Returns: number
      }
      calculate_shop_shipping_from_profiles: {
        Args: {
          p_requires_shipping?: boolean
          p_shop_id: string
          p_subtotal_after_discount: number
        }
        Returns: Json
      }
      call_edge_function_async:
        | { Args: { function_name: string; payload: Json }; Returns: undefined }
        | { Args: { function_name: string; payload: Json }; Returns: undefined }
      call_edge_function_async_http: {
        Args: { function_name: string; payload: Json }
        Returns: undefined
      }
      call_edge_function_via_pgnet: {
        Args: { function_name: string; payload: Json }
        Returns: undefined
      }
      can_access_order_issue: { Args: { p_issue_id: string }; Returns: boolean }
      can_access_shop: { Args: { shop_uuid: string }; Returns: boolean }
      can_moderate_meeting: { Args: { p_meeting_id: string }; Returns: boolean }
      can_users_message: {
        Args: { user1_id: string; user2_id: string }
        Returns: boolean
      }
      can_view_meeting: { Args: { p_meeting_id: string }; Returns: boolean }
      cancel_checkout_payment: {
        Args: { p_checkout_group_id: string }
        Returns: Json
      }
      cancel_customer_order: { Args: { p_order_id: string }; Returns: Json }
      cancel_order_return_request: {
        Args: { p_note?: string; p_order_item_id: string }
        Returns: Json
      }
      cancel_scheduled_notification: {
        Args: { p_notification_id: string; p_reason?: string }
        Returns: Json
      }
      cast_message_poll_vote: {
        Args: {
          p_message_id: string
          p_option_index: number
          p_user_id: string
        }
        Returns: undefined
      }
      cast_poll_vote: {
        Args: { p_option_id: string; p_poll_id: string; p_user_id: string }
        Returns: undefined
      }
      check_grammar:
        | { Args: { text_content: string }; Returns: Json[] }
        | { Args: { text_content: string; uid: string }; Returns: Json[] }
      cleanup_expired_email_otp: { Args: never; Returns: undefined }
      cleanup_expired_notifications: { Args: never; Returns: number }
      cleanup_expired_otp: { Args: never; Returns: undefined }
      cleanup_expired_stories_rows: { Args: never; Returns: number }
      cleanup_old_call_data: { Args: never; Returns: undefined }
      cleanup_old_notifications: { Args: never; Returns: number }
      cleanup_old_typing_indicators: { Args: never; Returns: undefined }
      cleanup_typing_indicators: { Args: never; Returns: undefined }
      cms_get_role: { Args: never; Returns: string }
      commerce_cart_bogo_discount: {
        Args: {
          p_cart_id: string
          p_cart_item_ids: string[]
          p_discount_id: string
        }
        Returns: number
      }
      commerce_cart_items_unavailable: {
        Args: { p_cart_id: string; p_cart_item_ids: string[] }
        Returns: boolean
      }
      commerce_cart_line_unit_price: {
        Args: {
          p_cart_unit: number
          p_listing_price: number
          p_metadata: Json
          p_variant_adj: number
        }
        Returns: number
      }
      commerce_discount_buyer_user_type: {
        Args: { p_user_id: string }
        Returns: string
      }
      commerce_discount_is_assigned: {
        Args: { p_discount_id: string; p_user_id: string }
        Returns: boolean
      }
      commerce_discount_user_type_ok: {
        Args: { p_buyer_type: string; p_eligible: string[] }
        Returns: boolean
      }
      commerce_listing_allows_preorder: {
        Args: { p_metadata: Json }
        Returns: boolean
      }
      community_company_facets: {
        Args: never
        Returns: {
          facet: string
          value: string
        }[]
      }
      community_event_types: {
        Args: never
        Returns: {
          value: string
        }[]
      }
      community_group_facets: {
        Args: never
        Returns: {
          facet: string
          value: string
        }[]
      }
      community_notification_categories: {
        Args: { p_user: string }
        Returns: {
          value: string
        }[]
      }
      complete_gender_verification_session: {
        Args: {
          p_client_metrics?: Json
          p_detected_blinks: number
          p_gender_confidence: number
          p_gender_detected: boolean
          p_liveness_score: number
          p_session_id: string
        }
        Returns: Json
      }
      complete_wallet_topup: { Args: { p_topup_id: string }; Returns: Json }
      confirm_order_return_received: {
        Args: { p_note?: string; p_order_item_id: string }
        Returns: Json
      }
      connection_occasions_today: {
        Args: { p_user_id?: string }
        Returns: {
          avatar_url: string
          company_name: string
          full_name: string
          label: string
          occasion: string
          user_id: string
          username: string
          years: number
        }[]
      }
      create_customer_order: { Args: { order_data: Json }; Returns: Json }
      create_digest_notifications: { Args: never; Returns: number }
      create_direct_chat: {
        Args: {
          user1_id: string
          user1_role?: string
          user2_id: string
          user2_role?: string
        }
        Returns: string
      }
      create_direct_conversation: {
        Args: { p_other_user_id: string }
        Returns: string
      }
      create_gender_verification_session: {
        Args: { p_required_blinks?: number }
        Returns: string
      }
      create_group_conversation: {
        Args: { p_participant_ids: string[]; p_title?: string }
        Returns: string
      }
      create_notification: {
        Args: { p_content?: Json; p_type: string; p_user_id: string }
        Returns: string
      }
      create_notification_from_template: {
        Args: {
          p_context_id?: string
          p_context_type?: string
          p_override_channels?: string[]
          p_override_priority?: number
          p_parent_context_id?: string
          p_parent_context_type?: string
          p_recipient_id: string
          p_scheduled_for?: string
          p_template_key: string
          p_variables?: Json
        }
        Returns: string
      }
      create_post_with_poll: {
        Args: {
          content: string
          duration: string
          options: string[]
          question: string
          user_id: string
        }
        Returns: {
          allow_comments: boolean | null
          allow_reactions: boolean | null
          audio_tracks: Json | null
          celebration_data: Json | null
          company_id: string | null
          content: string
          content_warning: string | null
          created_at: string | null
          engagement_score: number | null
          event_description: string | null
          event_end_time: string | null
          event_location: string | null
          event_rsvp_enabled: boolean | null
          event_start_time: string | null
          event_title: string | null
          group_id: string | null
          id: string
          image_url: string | null
          image_urls: string[] | null
          is_deleted: boolean | null
          is_pinned: boolean | null
          language: string | null
          link_preview_data: Json | null
          listing_id: string | null
          media_urls: string[] | null
          mentions: string[] | null
          metadata: Json | null
          original_post_id: string | null
          post_data: Json
          post_type: string | null
          product_data: Json | null
          published_at: string | null
          raw_api_post: Json | null
          repost_comment: string | null
          repost_count: number | null
          scheduled_at: string | null
          service_data: Json | null
          tags: string[] | null
          updated_at: string | null
          user_id: string | null
          video_url: string | null
          video_urls: string[] | null
          visibility: string | null
        }
        SetofOptions: {
          from: "*"
          to: "posts"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_qr_login_challenge: { Args: never; Returns: Json }
      create_sales_analytics_record: {
        Args: { p_order_item_id: string }
        Returns: undefined
      }
      create_smart_notification: {
        Args: {
          p_context_id?: string
          p_context_type?: string
          p_override_priority?: number
          p_parent_context_id?: string
          p_parent_context_type?: string
          p_recipient_id: string
          p_scheduled_for?: string
          p_source_system?: string
          p_template_key: string
          p_variables?: Json
        }
        Returns: string
      }
      create_support_ticket: {
        Args: {
          p_category?: string
          p_description: string
          p_priority?: string
          p_subject: string
          p_user_id: string
        }
        Returns: string
      }
      create_validated_notification: {
        Args: {
          p_context_id?: string
          p_context_type?: string
          p_override_priority?: number
          p_parent_context_id?: string
          p_parent_context_type?: string
          p_recipient_id: string
          p_scheduled_for?: string
          p_source_system?: string
          p_template_key: string
          p_variables?: Json
        }
        Returns: string
      }
      create_wallet_topup: {
        Args: { p_amount: number; p_currency?: string }
        Returns: string
      }
      crm_churn_score: {
        Args: { p_days: number; p_orders: number; p_refunded: number }
        Returns: number
      }
      crm_insight_text: {
        Args: {
          p_cart_value: number
          p_churn: number
          p_intent: number
          p_is_follower: boolean
          p_orders: number
          p_segment: string
        }
        Returns: string
      }
      crm_intent_score: {
        Args: {
          p_abandoned: boolean
          p_cart_value: number
          p_days: number
          p_recent_views: number
          p_wishlist: number
        }
        Returns: number
      }
      crm_predicted_clv: {
        Args: {
          p_churn: number
          p_days_since_first: number
          p_orders: number
          p_spent: number
        }
        Returns: number
      }
      crm_rfm_frequency_score: { Args: { p_orders: number }; Returns: number }
      crm_rfm_monetary_score: { Args: { p_spent: number }; Returns: number }
      crm_rfm_recency_score: { Args: { p_days: number }; Returns: number }
      crm_rfm_segment: {
        Args: {
          p_f: number
          p_is_follower: boolean
          p_orders: number
          p_r: number
        }
        Returns: string
      }
      currency_symbol: { Args: { p_iso_code: string }; Returns: string }
      daitch_mokotoff: { Args: { "": string }; Returns: string[] }
      debit_wallet_for_order: {
        Args: { p_amount: number; p_currency?: string; p_order_id: string }
        Returns: Json
      }
      debug_create_smart_notification: {
        Args: { p_recipient_id: string; p_template_key: string }
        Returns: string
      }
      debug_vendor_order_access: {
        Args: { p_user_id?: string; p_vendor_id: string }
        Returns: {
          can_access_items: boolean
          can_access_order: boolean
          item_count: number
          order_id: string
          order_number: string
        }[]
      }
      decrement_comment_likes: {
        Args: { comment_id: string }
        Returns: undefined
      }
      decrement_comment_replies: {
        Args: { comment_id: string }
        Returns: undefined
      }
      decrement_members_count: {
        Args: { group_id: string }
        Returns: undefined
      }
      delete_address: { Args: { address_id: string }; Returns: Json }
      delete_expired_stories: { Args: { p_ids: string[] }; Returns: number }
      delete_old_webrtc_signals: { Args: never; Returns: undefined }
      diagnose_order_amounts: {
        Args: { p_order_id: string }
        Returns: {
          check_name: string
          status: string
          value: string
        }[]
      }
      disable_notification_triggers: { Args: never; Returns: string }
      dispatch_marketplace_order_notifications: {
        Args: { p_order_id: string }
        Returns: undefined
      }
      dmetaphone: { Args: { "": string }; Returns: string }
      dmetaphone_alt: { Args: { "": string }; Returns: string }
      enable_notification_triggers: { Args: never; Returns: string }
      end_chat_session: {
        Args: { feedback?: string; rating?: number; session_id: string }
        Returns: boolean
      }
      ensure_meeting_room_id_rpc: {
        Args: { meeting_id_input: string }
        Returns: string
      }
      ensure_shop_customer_journeys: {
        Args: { p_shop_id: string }
        Returns: undefined
      }
      ensure_wallet_account: { Args: { p_currency?: string }; Returns: string }
      extract_file_name: { Args: { url: string }; Returns: string }
      extract_video_format: { Args: { url: string }; Returns: string }
      extract_video_source: { Args: { url: string }; Returns: string }
      finalize_shepay_bundle_charge: {
        Args: { p_checkout_group_id: string }
        Returns: Json
      }
      find_nearest_warehouse: {
        Args: { p_pin_code: string; p_product_id?: string; p_shop_id?: string }
        Returns: {
          distance_km: number
          estimated_delivery_days: number
          has_inventory: boolean
          warehouse_id: string
          warehouse_name: string
        }[]
      }
      find_or_create_direct_chat: {
        Args: { target_user: string }
        Returns: string
      }
      generate_category_seo_name: {
        Args: { category_name: string }
        Returns: string
      }
      generate_fulfillment_number: { Args: never; Returns: string }
      generate_listing_slug: {
        Args: { shop_id: string; title: string }
        Returns: string
      }
      generate_livekit_room_id: { Args: never; Returns: string }
      generate_meeting_code: { Args: never; Returns: string }
      generate_order_number: { Args: never; Returns: string }
      generate_referral_code: { Args: never; Returns: string }
      generate_ticket_number: { Args: never; Returns: string }
      generate_unique_username: { Args: never; Returns: string }
      generate_video_title: { Args: never; Returns: string }
      get_addresses_by_type: {
        Args: { address_type_filter?: string; target_user_id?: string }
        Returns: {
          address_label: string
          address_line_1: string
          address_line_2: string
          address_type: string
          city: string
          country: string
          created_at: string
          id: string
          is_default: boolean
          postal_code: string
          state: string
          updated_at: string
          user_id: string
        }[]
      }
      get_all_sent_requests: {
        Args: { sender: string }
        Returns: {
          created_at: string
          receiver_id: string
          status: string
        }[]
      }
      get_available_agents: {
        Args: { category?: string; max_results?: number }
        Returns: {
          agent_id: string
          agent_name: string
          current_chats: number
          last_activity: string
          max_chats: number
          specializations: string[]
          status: string
        }[]
      }
      get_category_children: {
        Args: { p_parent_id?: string }
        Returns: {
          category: string
          category_id: string
          description: string
          has_children: boolean
          level: number
          main_pair: Json
          position: number
          product_count: number
          seo_name: string
        }[]
      }
      get_category_path: {
        Args: { p_category_id: string }
        Returns: {
          category: string
          category_id: string
          level: number
          seo_name: string
        }[]
      }
      get_category_statistics: {
        Args: never
        Returns: {
          active_categories: number
          avg_products_per_category: number
          categories_with_products: number
          max_hierarchy_depth: number
          root_categories: number
          total_assignments: number
          total_categories: number
        }[]
      }
      get_category_tree_with_counts: {
        Args: { p_lang_code?: string; p_max_depth?: number; p_root_id?: string }
        Returns: {
          category: string
          category_id: string
          direct_product_count: number
          has_children: boolean
          level: number
          main_pair: Json
          parent_id: string
          path: string
          position: number
          product_count: number
          seo_name: string
        }[]
      }
      get_collaborative_recommendations: {
        Args: { max_recommendations?: number; target_user_id: string }
        Returns: {
          category: string
          id: string
          price: number
          shop_id: string
          shop_name: string
          similarity_score: number
          title: string
        }[]
      }
      get_connection_status: {
        Args: { user1_id: string; user2_id: string }
        Returns: {
          connection_id: string
          created_at: string
          receiver_id: string
          sender_id: string
          status: string
        }[]
      }
      get_connection_suggestions: {
        Args: { limit_count?: number; target_user_id: string }
        Returns: {
          avatar_url: string
          full_name: string
          headline: string
          mutual_count: number
          user_id: string
        }[]
      }
      get_conversation_messages: {
        Args: {
          limit_count?: number
          offset_count?: number
          user1_id: string
          user2_id: string
        }
        Returns: {
          content: string
          created_at: string
          id: string
          is_read: boolean
          message_type: string
          receiver_avatar: string
          receiver_id: string
          receiver_name: string
          sender_avatar: string
          sender_id: string
          sender_name: string
        }[]
      }
      get_event_attendance_from_existing: {
        Args: { event_post_id: string }
        Returns: {
          count: number
          status: string
        }[]
      }
      get_for_you_listing_ids: {
        Args: { max_results?: number }
        Returns: {
          id: string
        }[]
      }
      get_frequently_bought_together: {
        Args: { max_recommendations?: number; product_id: string }
        Returns: {
          category: string
          frequency_score: number
          id: string
          price: number
          shop_name: string
          title: string
        }[]
      }
      get_hashtag_suggestions: {
        Args: { max_results?: number; prefix?: string }
        Returns: {
          tag: string
          usage_count: number
        }[]
      }
      get_job_stats: { Args: { job_uuid: string }; Returns: Json }
      get_listing_active_cart_count: {
        Args: { p_listing_id: string }
        Returns: number
      }
      get_listing_recommendations: {
        Args: { p_limit?: number; p_listing_id: string }
        Returns: {
          id: string
          price: number
          primary_image_url: string
          shop_name: string
          slug: string
          title: string
        }[]
      }
      get_listing_review_analytics: {
        Args: {
          p_date_from?: string
          p_date_to?: string
          p_group_by?: string
          p_include_trends?: boolean
          p_listing_ids?: string[]
          p_rating_filter?: number[]
          p_sentiment_filter?: Database["public"]["Enums"]["review_sentiment_enum"][]
          p_shop_id?: string
          p_status_filter?: Database["public"]["Enums"]["listing_review_status_enum"][]
          p_verified_only?: boolean
        }
        Returns: Json
      }
      get_marketplace_bestseller_listings: {
        Args: { days_back?: number; max_results?: number; min_orders?: number }
        Returns: {
          id: string
          order_count: number
        }[]
      }
      get_marketplace_trending_listings: {
        Args: { days_back?: number; max_results?: number }
        Returns: {
          id: string
          order_count: number
          trending_score: number
        }[]
      }
      get_meeting_context: { Args: never; Returns: string }
      get_meeting_participant_context: { Args: never; Returns: string }
      get_mutual_connections_count: {
        Args: { user1_id: string; user2_id: string }
        Returns: number
      }
      get_nearby_shops_with_ratings: {
        Args: {
          max_distance_km?: number
          min_rating?: number
          user_lat: number
          user_lng: number
        }
        Returns: {
          average_rating: number
          city: string
          country: string
          created_at: string
          distance: number
          id: string
          latitude: number
          longitude: number
          shop_categories: string[]
          shop_description: string
          shop_name: string
          state: string
          total_reviews: number
          verified: boolean
        }[]
      }
      get_notification_system_health: { Args: never; Returns: Json }
      get_or_create_cart: {
        Args: { p_session_id?: string; p_user_id?: string }
        Returns: {
          applied_discount_id: string | null
          applied_discount_name: string | null
          applied_discount_type: string | null
          applied_discount_value: number | null
          cart_metadata: Json
          converted_at: string | null
          created_at: string
          currency: string
          discount_amount: number
          expires_at: string
          id: string
          items_subtotal: number
          last_activity_at: string
          session_id: string | null
          status: Database["public"]["Enums"]["cart_status_enum"]
          total_amount: number
          updated_at: string
          user_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "carts"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_order_context: { Args: never; Returns: string }
      get_order_delivery_context: { Args: never; Returns: string }
      get_order_digital_download: {
        Args: { p_order_item_id: string }
        Returns: Json
      }
      get_order_item_context: { Args: never; Returns: string }
      get_order_payment_context: { Args: never; Returns: string }
      get_personalized_search_results: {
        Args: {
          max_distance_km?: number
          max_results?: number
          search_query: string
          target_user_id: string
          user_lat?: number
          user_lng?: number
        }
        Returns: {
          category: string
          description: string
          distance: number
          id: string
          personal_score: number
          price: number
          relevance_score: number
          shop_name: string
          shop_verified: boolean
          tags: string[]
          title: string
        }[]
      }
      get_poll_results_from_existing: {
        Args: { poll_post_id: string }
        Returns: {
          option_id: string
          option_text: string
          percentage: number
          vote_count: number
        }[]
      }
      get_popular_tags: {
        Args: { p_limit?: number }
        Returns: {
          tag_name: string
          usage_count: number
        }[]
      }
      get_post_comments_threaded: {
        Args: {
          limit_param?: number
          offset_param?: number
          post_id_param: string
        }
        Returns: {
          author_avatar: string
          author_headline: string
          author_name: string
          content: string
          created_at: string
          id: string
          parent_comment_id: string
          post_id: string
          reply_count: number
          thread_level: number
          total_likes: number
          updated_at: string
          user_id: string
        }[]
      }
      get_post_reactions_detailed: {
        Args: { post_id_param: string }
        Returns: {
          created_at: string
          reaction_type: string
          user_avatar: string
          user_headline: string
          user_id: string
          user_name: string
        }[]
      }
      get_profile_analytics: {
        Args: { p_days?: number; p_user_id: string }
        Returns: {
          post_impressions_count: number
          post_impressions_last_30_days: number
          profile_views_count: number
          profile_views_last_30_days: number
          total_engagement: number
          unique_viewers_count: number
        }[]
      }
      get_profile_details: { Args: { p_user_id: string }; Returns: Json }
      get_profile_role: { Args: { uid: string }; Returns: string }
      get_public_shops: {
        Args: {
          limit_count?: number
          offset_count?: number
          search_term?: string
          verified_only?: boolean
        }
        Returns: {
          created_at: string
          id: string
          logo_url: string
          shop_categories: Json
          shop_description: string
          shop_name: string
          verified: boolean
        }[]
      }
      get_reaction_counts: {
        Args: { p_context_id: string; p_context_type: string }
        Returns: {
          count: number
          reaction_type: string
        }[]
      }
      get_saved_jobs: {
        Args: { user_uuid?: string }
        Returns: {
          application_count: number
          company_name: string
          created_at: string
          description: string
          experience_level: string
          id: string
          is_active: boolean
          is_applied: boolean
          is_remote: boolean
          job_id: string
          job_type: string
          location: string
          salary_range: string
          saved_at: string
          title: string
        }[]
      }
      get_scheduled_notification_stats: { Args: never; Returns: Json }
      get_shop_commerce_profile: { Args: { p_shop_id: string }; Returns: Json }
      get_shop_context: { Args: never; Returns: string }
      get_shop_customer_crm: {
        Args: { p_limit?: number; p_shop_id: string }
        Returns: {
          avatar_url: string
          average_order_value: number
          churn_score: number
          clv: number
          customer_id: string
          days_since_last_order: number
          display_name: string
          first_order_at: string
          insight: string
          intent_score: number
          is_follower: boolean
          last_order_at: string
          open_cart_value: number
          predicted_clv: number
          recent_view_count: number
          refunded_orders: number
          rfm_segment: string
          tags: string[]
          total_orders: number
          total_spent: number
          username: string
          wishlist_count: number
        }[]
      }
      get_shop_listings: {
        Args: {
          p_is_active?: boolean
          p_is_online?: boolean
          p_limit?: number
          p_listing_status?: Database["public"]["Enums"]["listing_status_enum"]
          p_listing_type?: Database["public"]["Enums"]["listing_type_enum"]
          p_max_price?: number
          p_min_price?: number
          p_offset?: number
          p_search_term?: string
          p_shop_id: string
          p_similarity_threshold?: number
        }
        Returns: {
          created_at: string
          description: string
          id: string
          is_active: boolean
          is_featured: boolean
          is_online: boolean
          listing_status: Database["public"]["Enums"]["listing_status_enum"]
          listing_type: Database["public"]["Enums"]["listing_type_enum"]
          price: number
          primary_image_url: string
          quantity: number
          similarity_score: number
          slug: string
          title: string
          updated_at: string
        }[]
      }
      get_shop_owner_reviews_simple: {
        Args: {
          p_limit?: number
          p_page?: number
          p_shop_id?: string
          p_status?: string
        }
        Returns: Json
      }
      get_shop_payment_status: {
        Args: { shop_uuid: string }
        Returns: {
          active_providers: string[]
          has_payment_account: boolean
          payment_settings_configured: boolean
        }[]
      }
      get_shop_posts: {
        Args: { p_shop_id: string }
        Returns: {
          listing_id: string
          listing_title: string
          post_content: string
          post_id: string
        }[]
      }
      get_shop_review_statistics: { Args: { p_shop_id: string }; Returns: Json }
      get_shop_review_stats: { Args: { p_shop_id: string }; Returns: Json }
      get_shop_reviews_public: {
        Args: {
          p_limit?: number
          p_max_rating?: number
          p_min_rating?: number
          p_page?: number
          p_shop_id: string
        }
        Returns: Json
      }
      get_shop_sections: {
        Args: { p_shop_id: string }
        Returns: {
          description: string
          display_order: number
          id: string
          is_active: boolean
          listing_count: number
          section_name: string
          slug: string
        }[]
      }
      get_shop_sections_with_counts: {
        Args: { p_shop_id: string }
        Returns: {
          active_listing_count: number
          active_listings: Json
          description: string
          display_order: number
          draft_listing_count: number
          draft_listings: Json
          featured_listing_count: number
          id: string
          listing_count: number
          section_name: string
          section_stats: Json
          slug: string
          total_value: number
        }[]
      }
      get_shop_seo_data: {
        Args: { shop_slug: string }
        Returns: {
          canonical_url: string
          meta_description: string
          meta_title: string
          open_graph_description: string
          open_graph_image: string
          open_graph_title: string
          robots_follow: boolean
          robots_index: boolean
          seo_description: string
          seo_keywords: string[]
          seo_title: string
          shop_id: string
          shop_name: string
          structured_data: Json
          twitter_card_type: string
          twitter_description: string
          twitter_image: string
          twitter_title: string
        }[]
      }
      get_shop_stats: { Args: { shop_id_param: string }; Returns: Json }
      get_status_feed: {
        Args: never
        Returns: {
          background_color: string
          content: string
          created_at: string
          expires_at: string
          id: string
          media_type: string
          media_url: string
          text_color: string
          total_reactions: number
          user_avatar: string
          user_id: string
          user_name: string
          user_viewed: boolean
          view_count: number
        }[]
      }
      get_story_feed: {
        Args: never
        Returns: {
          background_color: string
          content: string
          created_at: string
          expires_at: string
          id: string
          media_type: string
          media_url: string
          text_color: string
          user_avatar: string
          user_id: string
          user_name: string
          user_username: string
          user_viewed: boolean
          view_count: number
        }[]
      }
      get_story_viewers: {
        Args: { p_story_id: string }
        Returns: {
          avatar_url: string
          full_name: string
          username: string
          viewed_at: string
          viewer_id: string
        }[]
      }
      get_support_stats: {
        Args: { p_user_id: string }
        Returns: {
          average_response_time_minutes: number
          average_satisfaction_rating: number
          open_conversations: number
          resolved_conversations: number
          total_conversations: number
        }[]
      }
      get_trending_products_nearby: {
        Args: {
          days_back?: number
          max_distance_km?: number
          user_lat: number
          user_lng: number
        }
        Returns: {
          category: string
          created_at: string
          description: string
          distance: number
          id: string
          is_featured: boolean
          listing_type: string
          order_count: number
          price: number
          quantity: number
          shop_id: string
          shop_name: string
          shop_verified: boolean
          tags: string[]
          title: string
        }[]
      }
      get_unread_notification_count: {
        Args: { p_user_id: string }
        Returns: number
      }
      get_user_addresses: {
        Args: { target_user_id?: string }
        Returns: {
          address_label: string
          address_line_1: string
          address_line_2: string
          address_type: string
          city: string
          country: string
          created_at: string
          id: string
          is_default: boolean
          postal_code: string
          state: string
          updated_at: string
          user_id: string
        }[]
      }
      get_user_applications: {
        Args: { user_uuid?: string }
        Returns: {
          applied_at: string
          company_name: string
          cover_letter: string
          id: string
          job_id: string
          job_is_active: boolean
          job_title: string
          job_type: string
          location: string
          notes: string
          resume_url: string
          status: string
        }[]
      }
      get_user_chats: {
        Args: { p_user_id: string }
        Returns: {
          avatar_url: string
          chat_id: string
          chat_name: string
          chat_type: string
          current_user_role: string
          is_archived: boolean
          is_muted: boolean
          is_online: boolean
          is_pinned: boolean
          last_message: string
          last_message_sender_name: string
          last_message_time: string
          last_message_type: string
          last_seen: string
          other_user_avatar: string
          other_user_id: string
          other_user_name: string
          other_user_role: string
          unread_count: number
        }[]
      }
      get_user_connections: {
        Args: { connection_status?: string; target_user_id: string }
        Returns: {
          avatar_url: string
          connection_id: string
          created_at: string
          full_name: string
          headline: string
          is_sender: boolean
          mutual_count: number
          status: string
          user_id: string
        }[]
      }
      get_user_contact_info: {
        Args: {
          p_context_id?: string
          p_context_type?: string
          p_user_id: string
        }
        Returns: Json
      }
      get_user_conversations: {
        Args: { current_user_id: string; search_query?: string }
        Returns: {
          conversation_id: string
          is_sender: boolean
          last_message: string
          last_message_at: string
          last_message_type: string
          other_user_avatar: string
          other_user_id: string
          other_user_name: string
          unread_count: number
        }[]
      }
      get_user_email: { Args: { user_id: string }; Returns: string }
      get_user_feed:
        | {
            Args: {
              limit_param?: number
              offset_param?: number
              sort_by?: string
              user_id_param: string
            }
            Returns: {
              author_avatar: string
              author_headline: string
              author_name: string
              author_verified: boolean
              content: string
              created_at: string
              id: string
              media_urls: string[]
              post_type: string
              total_comments: number
              total_reactions: number
              total_views: number
              updated_at: string
              user_id: string
              user_reaction: string
            }[]
          }
        | {
            Args: {
              content_filter?: string
              limit_param?: number
              offset_param?: number
              sort_by?: string
              user_id_param: string
            }
            Returns: {
              allow_comments: boolean
              allow_reactions: boolean
              author_avatar: string
              author_headline: string
              author_name: string
              celebrate_count: number
              content: string
              created_at: string
              funny_count: number
              id: string
              image_url: string
              insightful_count: number
              is_pinned: boolean
              like_count: number
              link_preview_data: Json
              love_count: number
              original_post_author_avatar: string
              original_post_author_headline: string
              original_post_author_name: string
              original_post_content: string
              original_post_id: string
              original_post_image_url: string
              original_post_link_preview_data: Json
              original_post_video_url: string
              post_content_type: string
              post_type: string
              repost_details_id: string
              support_count: number
              total_comments: number
              total_reactions: number
              total_views: number
              updated_at: string
              user_id: string
              user_reaction: string
              video_url: string
              visibility: string
            }[]
          }
      get_user_notification_preferences: {
        Args: {
          p_category?: string
          p_notification_type?: string
          p_platform?: string
          p_user_id: string
        }
        Returns: {
          email_enabled: boolean
          frequency: string
          in_app_enabled: boolean
          push_enabled: boolean
          quiet_hours_end: string
          quiet_hours_start: string
          sms_enabled: boolean
          timezone: string
          whatsapp_enabled: boolean
        }[]
      }
      get_user_notifications: {
        Args: {
          p_limit?: number
          p_offset?: number
          p_unread_only?: boolean
          p_user_id: string
        }
        Returns: {
          content: Json
          created_at: string
          id: string
          is_read: boolean
          post_id: string
          post_preview: string
          sender_avatar: string
          sender_headline: string
          sender_id: string
          sender_name: string
          type: string
        }[]
      }
      get_user_reaction: {
        Args: {
          p_context_id: string
          p_context_type: string
          p_user_id: string
        }
        Returns: string
      }
      get_user_shops: {
        Args: { user_uuid?: string }
        Returns: {
          created_at: string
          id: string
          is_active: boolean
          shop_name: string
          verified: boolean
        }[]
      }
      get_user_stats: {
        Args: { user_id?: string }
        Returns: {
          active_users: number
          female_users: number
          male_users: number
          total_users: number
          vendors: number
          verified_users: number
        }[]
      }
      get_user_statuses_with_views: {
        Args: { target_user_id: string }
        Returns: {
          background_color: string
          content: string
          created_at: string
          expires_at: string
          id: string
          media_type: string
          media_url: string
          text_color: string
          total_reactions: number
          user_viewed: boolean
          view_count: number
        }[]
      }
      get_user_stories_with_views: {
        Args: { target_user_id: string }
        Returns: {
          background_color: string
          content: string
          created_at: string
          expires_at: string
          id: string
          media_type: string
          media_url: string
          text_color: string
          user_id: string
          user_viewed: boolean
          view_count: number
        }[]
      }
      get_valid_context_type: {
        Args: { p_context_type: string; p_platform?: string }
        Returns: boolean
      }
      get_vendor_order_context: { Args: never; Returns: string }
      get_wallet_balance: { Args: { p_currency?: string }; Returns: number }
      handle_delivery_rto: { Args: { p_delivery_id: string }; Returns: Json }
      handle_return_leg_delivered: {
        Args: { p_delivery_id: string }
        Returns: Json
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      http: {
        Args: { request: Database["public"]["CompositeTypes"]["http_request"] }
        Returns: Database["public"]["CompositeTypes"]["http_response"]
        SetofOptions: {
          from: "http_request"
          to: "http_response"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      http_delete:
        | {
            Args: { uri: string }
            Returns: Database["public"]["CompositeTypes"]["http_response"]
            SetofOptions: {
              from: "*"
              to: "http_response"
              isOneToOne: true
              isSetofReturn: false
            }
          }
        | {
            Args: { content: string; content_type: string; uri: string }
            Returns: Database["public"]["CompositeTypes"]["http_response"]
            SetofOptions: {
              from: "*"
              to: "http_response"
              isOneToOne: true
              isSetofReturn: false
            }
          }
      http_get:
        | {
            Args: { uri: string }
            Returns: Database["public"]["CompositeTypes"]["http_response"]
            SetofOptions: {
              from: "*"
              to: "http_response"
              isOneToOne: true
              isSetofReturn: false
            }
          }
        | {
            Args: { data: Json; uri: string }
            Returns: Database["public"]["CompositeTypes"]["http_response"]
            SetofOptions: {
              from: "*"
              to: "http_response"
              isOneToOne: true
              isSetofReturn: false
            }
          }
      http_head: {
        Args: { uri: string }
        Returns: Database["public"]["CompositeTypes"]["http_response"]
        SetofOptions: {
          from: "*"
          to: "http_response"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      http_header: {
        Args: { field: string; value: string }
        Returns: Database["public"]["CompositeTypes"]["http_header"]
        SetofOptions: {
          from: "*"
          to: "http_header"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      http_list_curlopt: {
        Args: never
        Returns: {
          curlopt: string
          value: string
        }[]
      }
      http_patch: {
        Args: { content: string; content_type: string; uri: string }
        Returns: Database["public"]["CompositeTypes"]["http_response"]
        SetofOptions: {
          from: "*"
          to: "http_response"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      http_post:
        | {
            Args: { content: string; content_type: string; uri: string }
            Returns: Database["public"]["CompositeTypes"]["http_response"]
            SetofOptions: {
              from: "*"
              to: "http_response"
              isOneToOne: true
              isSetofReturn: false
            }
          }
        | {
            Args: { data: Json; uri: string }
            Returns: Database["public"]["CompositeTypes"]["http_response"]
            SetofOptions: {
              from: "*"
              to: "http_response"
              isOneToOne: true
              isSetofReturn: false
            }
          }
      http_put: {
        Args: { content: string; content_type: string; uri: string }
        Returns: Database["public"]["CompositeTypes"]["http_response"]
        SetofOptions: {
          from: "*"
          to: "http_response"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      http_reset_curlopt: { Args: never; Returns: boolean }
      http_set_curlopt: {
        Args: { curlopt: string; value: string }
        Returns: boolean
      }
      increment_comment_likes: {
        Args: { comment_id: string }
        Returns: undefined
      }
      increment_comment_replies: {
        Args: { comment_id: string }
        Returns: undefined
      }
      increment_members_count: {
        Args: { group_id: string }
        Returns: undefined
      }
      increment_poll_option_votes: {
        Args: { option_id: string }
        Returns: undefined
      }
      increment_poll_vote: {
        Args: { option_idx: number; post_id: string }
        Returns: undefined
      }
      increment_program_play_count: {
        Args: { p_play_type: string; p_program_id: string }
        Returns: undefined
      }
      increment_program_views: {
        Args: { program_id: string }
        Returns: undefined
      }
      invite_network_by_email: {
        Args: { p_email: string; p_message?: string }
        Returns: Json
      }
      is_community_group_admin: {
        Args: { p_group_id: string; p_user_id?: string }
        Returns: boolean
      }
      is_company_page_manager: {
        Args: { p_company_id: string; p_user_id?: string }
        Returns: boolean
      }
      is_company_page_owner: {
        Args: { p_company_id: string; p_user_id?: string }
        Returns: boolean
      }
      is_recording_object_host_owned: {
        Args: { object_name: string }
        Returns: boolean
      }
      list_expired_stories_for_cleanup: {
        Args: { p_grace_hours?: number }
        Returns: {
          id: string
          media_url: string
        }[]
      }
      log_payment_event: {
        Args: {
          p_amount?: number
          p_currency?: string
          p_error_code?: string
          p_error_message?: string
          p_event_type: Database["public"]["Enums"]["payment_log_event_type_enum"]
          p_order_payment_id: string
          p_payload?: Json
          p_provider?: Database["public"]["Enums"]["payment_provider_enum"]
          p_shop_id: string
          p_status: Database["public"]["Enums"]["payment_log_status_enum"]
          p_transaction_id?: string
        }
        Returns: string
      }
      manual_populate_delivery_discounts: {
        Args: { p_order_item_id: string }
        Returns: {
          delivery_created: boolean
          discounts_applied: number
          message: string
        }[]
      }
      mark_all_notifications_read: {
        Args: { p_user_id: string }
        Returns: number
      }
      mark_messages_as_delivered: {
        Args: { p_chat_room_id: string; p_user_id: string }
        Returns: undefined
      }
      mark_messages_as_read: {
        Args: { p_chat_room_id: string; p_user_id: string }
        Returns: undefined
      }
      mark_notification_read: {
        Args: { p_notification_id: string; p_user_id?: string }
        Returns: boolean
      }
      mark_qr_login_challenge_consumed: {
        Args: { p_id: string }
        Returns: undefined
      }
      merge_carts: {
        Args: { p_session_id: string; p_user_id: string }
        Returns: {
          applied_discount_id: string | null
          applied_discount_name: string | null
          applied_discount_type: string | null
          applied_discount_value: number | null
          cart_metadata: Json
          converted_at: string | null
          created_at: string
          currency: string
          discount_amount: number
          expires_at: string
          id: string
          items_subtotal: number
          last_activity_at: string
          session_id: string | null
          status: Database["public"]["Enums"]["cart_status_enum"]
          total_amount: number
          updated_at: string
          user_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "carts"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      migrate_category_from_cscart: {
        Args: {
          p_category_name: string
          p_cscart_id: number
          p_description?: string
          p_parent_cscart_id?: number
          p_position?: number
          p_seo_name?: string
          p_status?: string
        }
        Returns: string
      }
      normalize_iso_country_code: { Args: { p_value: string }; Returns: string }
      poll_qr_login_challenge: { Args: { p_id: string }; Returns: Json }
      process_abandoned_carts: { Args: { p_limit?: number }; Returns: number }
      process_checkout_payment_webhook:
        | {
            Args: {
              p_amount?: number
              p_checkout_group_id: string
              p_currency?: string
              p_metadata?: Json
              p_provider: string
              p_provider_reference: string
              p_status: string
            }
            Returns: Json
          }
        | {
            Args: {
              p_event_type: string
              p_payload?: Json
              p_payment_step_id: string
              p_provider: Database["public"]["Enums"]["payment_provider_enum"]
              p_provider_reference?: string
              p_shop_id: string
              p_status: string
              p_webhook_id: string
            }
            Returns: Json
          }
      process_community_weekly_digest: {
        Args: { p_limit?: number }
        Returns: number
      }
      process_due_reorder_schedules: {
        Args: { p_limit?: number }
        Returns: number
      }
      process_event_reminders: { Args: never; Returns: number }
      process_network_suggestions_digest: {
        Args: { p_limit?: number }
        Returns: number
      }
      process_notification_queue: { Args: never; Returns: number }
      process_order_confirmation_reminders: {
        Args: { p_limit?: number }
        Returns: number
      }
      process_product_reminders: { Args: { p_limit?: number }; Returns: Json }
      process_scheduled_notifications_now: { Args: never; Returns: Json }
      process_shop_customer_journeys: {
        Args: { p_limit?: number; p_shop_id?: string }
        Returns: number
      }
      profiles_generate_unique_username: {
        Args: { p_base: string }
        Returns: string
      }
      reconcile_sponsored_campaigns: { Args: never; Returns: number }
      record_auth_login_session: {
        Args: {
          p_auth_session_id?: string
          p_device_id: string
          p_device_label?: string
          p_geo?: Json
          p_ip?: string
          p_platform?: string
          p_provider?: string
          p_user_agent?: string
        }
        Returns: Json
      }
      record_listing_view: {
        Args: { p_listing_id: string }
        Returns: undefined
      }
      refresh_active_listings_view: { Args: never; Returns: undefined }
      refresh_listing_demand_forecasts: { Args: never; Returns: number }
      refresh_review_summary: { Args: never; Returns: undefined }
      release_expired_checkout_reservations: { Args: never; Returns: number }
      remove_discount_from_cart: {
        Args: { p_cart_id: string }
        Returns: {
          applied_discount_id: string | null
          applied_discount_name: string | null
          applied_discount_type: string | null
          applied_discount_value: number | null
          cart_metadata: Json
          converted_at: string | null
          created_at: string
          currency: string
          discount_amount: number
          expires_at: string
          id: string
          items_subtotal: number
          last_activity_at: string
          session_id: string | null
          status: Database["public"]["Enums"]["cart_status_enum"]
          total_amount: number
          updated_at: string
          user_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "carts"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      remove_group_participant: {
        Args: { p_conversation_id: string; p_user_id: string }
        Returns: undefined
      }
      reply_to_listing_inquiry: {
        Args: { p_close?: boolean; p_inquiry_id: string; p_reply: string }
        Returns: Json
      }
      request_introduction: {
        Args: {
          p_introducer_id: string
          p_message?: string
          p_target_id: string
        }
        Returns: Json
      }
      request_order_exchange: {
        Args: {
          p_detailed_reason?: string
          p_evidence_urls?: string[]
          p_order_item_id: string
          p_reason: string
        }
        Returns: Json
      }
      request_order_return: {
        Args: {
          p_detailed_reason?: string
          p_evidence_urls?: string[]
          p_order_item_id: string
          p_reason: string
        }
        Returns: Json
      }
      reschedule_notification: {
        Args: { p_new_scheduled_time: string; p_notification_id: string }
        Returns: Json
      }
      resolve_fulfillment_exception: {
        Args: { p_fulfillment_id: string; p_note: string; p_retry_at?: string }
        Returns: Json
      }
      resolve_order_issue_request: {
        Args: {
          p_decision: string
          p_issue_id: string
          p_reject_reason_code?: string
          p_resolution_note?: string
        }
        Returns: Json
      }
      resolve_support_conversation: {
        Args: { p_conversation_id: string; p_rating?: number }
        Returns: undefined
      }
      resolve_wishlist_share: { Args: { p_token: string }; Returns: Json }
      resume_checkout_payment: {
        Args: { p_checkout_group_id: string }
        Returns: Json
      }
      revoke_all_auth_login_sessions: { Args: never; Returns: undefined }
      revoke_auth_login_session: {
        Args: { p_session_id: string }
        Returns: undefined
      }
      revoke_other_auth_login_sessions: {
        Args: { p_keep_device_id: string }
        Returns: undefined
      }
      safe_update_profile: {
        Args: { update_data: Json; user_id: string }
        Returns: boolean
      }
      save_shop_section: {
        Args: {
          p_description?: string
          p_is_active?: boolean
          p_listing_ids?: string[]
          p_name?: string
          p_section_id?: string
          p_shop_id: string
        }
        Returns: string
      }
      schedule_meeting_reminders: { Args: never; Returns: number }
      search_categories_ranked: {
        Args: {
          p_lang_code?: string
          p_limit?: number
          p_offset?: number
          p_search_term: string
        }
        Returns: {
          category: string
          category_id: string
          description: string
          level: number
          product_count: number
          rank_score: number
          seo_name: string
        }[]
      }
      search_jobs: {
        Args: {
          experience_filter?: string
          is_remote_filter?: boolean
          job_location?: string
          job_type_filter?: string
          limit_count?: number
          offset_count?: number
          search_query?: string
        }
        Returns: {
          application_count: number
          benefits: string
          company_logo: string
          company_name: string
          created_at: string
          description: string
          experience_level: string
          expires_at: string
          id: string
          is_active: boolean
          is_applied: boolean
          is_remote: boolean
          is_saved: boolean
          job_type: string
          location: string
          posted_by: string
          poster_avatar: string
          poster_name: string
          requirements: string
          salary_range: string
          title: string
          updated_at: string
        }[]
      }
      search_listings: {
        Args: {
          p_is_featured?: boolean
          p_limit?: number
          p_listing_type?: Database["public"]["Enums"]["listing_type_enum"]
          p_max_price?: number
          p_min_price?: number
          p_offset?: number
          p_search_term?: string
          p_shop_id?: string
          p_tags?: string[]
        }
        Returns: {
          created_at: string
          description: string
          id: string
          is_featured: boolean
          listing_type: Database["public"]["Enums"]["listing_type_enum"]
          price: number
          primary_image_url: string
          shop_name: string
          shop_verified: boolean
          slug: string
          title: string
        }[]
      }
      seller_create_shop_with_points: {
        Args: {
          p_shop_currency?: string
          p_shop_description?: string
          p_shop_name: string
        }
        Returns: string
      }
      send_message: {
        Args: {
          p_chat_room_id: string
          p_content: string
          p_file_name?: string
          p_file_size?: number
          p_file_type?: string
          p_file_url?: string
          p_message_type?: string
          p_reply_to_id?: string
          p_sender_id: string
        }
        Returns: string
      }
      send_message_with_status: {
        Args: {
          p_chat_room_id: string
          p_content: string
          p_file_name?: string
          p_file_size?: number
          p_file_type?: string
          p_file_url?: string
          p_message_type?: string
          p_metadata?: Json
          p_reply_to_id?: string
          p_sender_id: string
        }
        Returns: string
      }
      send_shop_announcement: {
        Args: { p_message: string; p_shop_id: string }
        Returns: Json
      }
      set_community_group_member_role: {
        Args: { p_group_id: string; p_role: string; p_user_id: string }
        Returns: undefined
      }
      set_company_member_role: {
        Args: { p_company_id: string; p_role: string; p_user_id: string }
        Returns: undefined
      }
      set_default_address: { Args: { address_id: string }; Returns: Json }
      set_group_participant_role: {
        Args: { p_conversation_id: string; p_role: string; p_user_id: string }
        Returns: undefined
      }
      set_typing_indicator: {
        Args: {
          p_chat_room_id: string
          p_is_typing: boolean
          p_user_id: string
        }
        Returns: undefined
      }
      set_uploaded_by: { Args: never; Returns: string }
      shop_customer_crm_rows: {
        Args: { p_limit?: number; p_shop_id: string }
        Returns: {
          avatar_url: string
          average_order_value: number
          churn_score: number
          clv: number
          customer_id: string
          days_since_last_order: number
          display_name: string
          first_order_at: string
          insight: string
          intent_score: number
          is_follower: boolean
          last_order_at: string
          open_cart_value: number
          predicted_clv: number
          recent_view_count: number
          refunded_orders: number
          rfm_segment: string
          tags: string[]
          total_orders: number
          total_spent: number
          username: string
          wishlist_count: number
        }[]
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      slugify: { Args: { "": string }; Returns: string }
      soundex: { Args: { "": string }; Returns: string }
      strip_html_tags: { Args: { p_html: string }; Returns: string }
      submit_return_tracking: {
        Args: {
          p_courier_slug?: string
          p_order_item_id: string
          p_tracking_number: string
        }
        Returns: Json
      }
      submit_verified_listing_review: {
        Args: {
          p_order_item_id: string
          p_rating: number
          p_review_images?: Json
          p_review_text?: string
          p_title?: string
        }
        Returns: Json
      }
      substitute_template_variables: {
        Args: { template_text: string; variables: Json }
        Returns: string
      }
      sync_order_fulfillment: { Args: { p_order_id: string }; Returns: Json }
      test_edge_call_debug: { Args: never; Returns: string }
      test_edge_function_connectivity: { Args: never; Returns: string }
      test_order_notification_fix: {
        Args: { p_order_id: string }
        Returns: {
          amount_shown: number
          notification_id: string
          order_number: string
          recipient_type: string
          variables: Json
        }[]
      }
      test_webhook_functions: { Args: never; Returns: Json }
      text_soundex: { Args: { "": string }; Returns: string }
      text_to_bytea: { Args: { data: string }; Returns: string }
      track_post_impression: {
        Args: {
          p_post_id: string
          p_view_duration?: number
          p_viewer_user_id?: string
        }
        Returns: undefined
      }
      track_profile_view: {
        Args: { p_profile_user_id: string; p_viewer_user_id?: string }
        Returns: undefined
      }
      update_cart_totals: { Args: { p_cart_id: string }; Returns: undefined }
      update_existing_shops_seo: { Args: never; Returns: undefined }
      update_group_info: {
        Args: {
          p_avatar_url?: string
          p_conversation_id: string
          p_title?: string
        }
        Returns: undefined
      }
      update_listing_stock: {
        Args: {
          p_listing_id: string
          p_quantity_change: number
          p_variation_id?: string
        }
        Returns: Json
      }
      update_login_info: {
        Args: {
          device_information?: Json
          ip_address?: string
          location_info?: Json
          user_id: string
        }
        Returns: undefined
      }
      update_notification_preferences: {
        Args: { p_preferences: Json; p_user_id: string }
        Returns: boolean
      }
      update_sales_analytics_refund_status: {
        Args: {
          p_order_item_id: string
          p_refund_amount: number
          p_refund_status: Database["public"]["Enums"]["refund_status_enum"]
        }
        Returns: undefined
      }
      update_sales_analytics_return_status: {
        Args: {
          p_is_returned: boolean
          p_order_item_id: string
          p_return_reason?: string
        }
        Returns: undefined
      }
      update_user_preferences: {
        Args: { target_user_id: string }
        Returns: Json
      }
      update_user_presence: {
        Args: { p_is_online: boolean; p_status: string; p_user_id: string }
        Returns: undefined
      }
      upsert_conversation_context: {
        Args: { p_query: string; p_session_id: string; p_user_id: string }
        Returns: string
      }
      upsert_profile_for_auth_user: {
        Args: {
          p_email: string
          p_email_confirmed_at: string
          p_id: string
          p_phone: string
          p_phone_confirmed_at: string
          p_raw_user_meta_data: Json
        }
        Returns: undefined
      }
      urlencode:
        | { Args: { data: Json }; Returns: string }
        | {
            Args: { string: string }
            Returns: {
              error: true
            } & "Could not choose the best candidate function between: public.urlencode(string => bytea), public.urlencode(string => varchar). Try renaming the parameters or the function itself in the database so function overloading can be resolved"
          }
        | {
            Args: { string: string }
            Returns: {
              error: true
            } & "Could not choose the best candidate function between: public.urlencode(string => bytea), public.urlencode(string => varchar). Try renaming the parameters or the function itself in the database so function overloading can be resolved"
          }
      user_is_conversation_participant: {
        Args: { p_conversation_id: string }
        Returns: boolean
      }
      vendor_bulk_update_listings: {
        Args: {
          p_category?: string
          p_listing_ids: string[]
          p_price_percent?: number
          p_shop_id: string
          p_status?: string
          p_stock_delta?: number
        }
        Returns: number
      }
      vendor_create_promotion: {
        Args: {
          p_code: string
          p_discount_type: string
          p_discount_value: number
          p_max_discount_amount?: number
          p_min_order_amount?: number
          p_name: string
          p_shop_id: string
          p_valid_until?: string
        }
        Returns: string
      }
      vendor_reply_to_review: {
        Args: { p_reply: string; p_review_id: string }
        Returns: string
      }
      verify_business_profile: {
        Args: { profile_id: string; verified_by: string }
        Returns: boolean
      }
      verify_meeting_passcode: {
        Args: { meeting_id_input: string; passcode_input: string }
        Returns: boolean
      }
      wallet_apply_topup: {
        Args: { p_topup_id: string }
        Returns: {
          available: number
          currency: string
          pending: number
          topup_id: string
        }[]
      }
      wallet_award_points_service: {
        Args: {
          p_amount: number
          p_metadata?: Json
          p_reason: string
          p_user_id: string
        }
        Returns: undefined
      }
      wallet_ensure_account: { Args: { p_currency?: string }; Returns: string }
      wallet_get_balance: {
        Args: { p_currency?: string }
        Returns: {
          available: number
          currency: string
          pending: number
        }[]
      }
      wallet_pay_order: {
        Args: { p_order_id: string }
        Returns: {
          available: number
          currency: string
          order_id: string
          pending: number
        }[]
      }
      wallet_spend_points: {
        Args: { p_amount: number; p_metadata?: Json; p_reason: string }
        Returns: {
          available: number
          currency: string
          pending: number
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
      call_invite_status: "ringing" | "joined" | "declined" | "missed"
      call_status:
        | "ringing"
        | "active"
        | "declined"
        | "missed"
        | "ended"
        | "cancelled"
      call_type: "audio" | "video"
      cart_status_enum: "active" | "abandoned" | "converted" | "expired"
      category_status_enum: "A" | "D" | "H"
      cms_content_status:
        | "draft"
        | "review"
        | "scheduled"
        | "published"
        | "archived"
      cms_content_type: "post" | "page" | "product" | "announcement"
      cms_media_type: "image" | "video" | "document" | "audio" | "other"
      delivery_status_enum:
        | "pending"
        | "ready_to_ship"
        | "shipped"
        | "in_transit"
        | "out_for_delivery"
        | "delivered"
        | "failed_delivery"
        | "returned_to_sender"
        | "lost"
        | "damaged"
        | "cancelled"
      fulfillment_status_enum:
        | "pending"
        | "processing"
        | "ready_to_ship"
        | "shipped"
        | "out_for_delivery"
        | "delivered"
        | "delivery_failed"
        | "returned_to_sender"
        | "cancelled"
        | "returned"
        | "exception"
      inventory_status_enum:
        | "in_stock"
        | "low_stock"
        | "out_of_stock"
        | "pre_order"
        | "discontinued"
      listing_review_status_enum:
        | "pending"
        | "approved"
        | "rejected"
        | "flagged"
        | "hidden"
        | "spam"
      listing_status_enum:
        | "draft"
        | "active"
        | "paused"
        | "sold_out"
        | "archived"
      listing_type_enum: "physical" | "digital" | "service"
      order_status_enum:
        | "pending"
        | "awaiting_payment"
        | "payment_failed"
        | "confirmed"
        | "processing"
        | "shipped"
        | "in_transit"
        | "out_for_delivery"
        | "delivered"
        | "completed"
        | "cancelled"
        | "refunded"
        | "disputed"
        | "returned"
        | "partially_shipped"
        | "on_hold"
        | "failed_delivery"
      payment_account_status_enum:
        | "connected"
        | "disconnected"
        | "pending"
        | "suspended"
        | "expired"
      payment_log_event_type_enum:
        | "success"
        | "failure"
        | "refund"
        | "webhook"
        | "capture"
        | "authorization"
        | "settlement"
        | "chargeback"
        | "dispute"
      payment_log_status_enum:
        | "completed"
        | "failed"
        | "pending"
        | "processing"
        | "cancelled"
      payment_mode_enum:
        | "cod"
        | "online"
        | "bank_transfer"
        | "wallet"
        | "upi"
        | "card"
        | "emi"
        | "pay_later"
      payment_provider_enum:
        | "razorpay"
        | "paypal"
        | "stripe"
        | "payu"
        | "cashfree"
        | "phonepe"
        | "googlepay"
        | "paytm"
        | "paystack"
        | "mercado"
        | "skrill"
        | "paymentwall"
        | "flutterwave"
        | "mollie"
        | "coingate"
        | "sspay"
        | "toyyibpay"
        | "paytabs"
        | "iyzipay"
        | "payfast"
        | "benefit"
        | "aamarpay"
        | "paytr"
        | "yookassa"
        | "xendit"
        | "midtrans"
        | "nepalste"
        | "khalti"
        | "payhere"
        | "authorizenet"
        | "tap"
        | "paddle"
        | "paiementpro"
        | "fedpay"
        | "cinetpay"
        | "senagepay"
        | "cybersource"
        | "ozow"
        | "myfatoorah"
        | "easebuzz"
        | "nmi"
        | "sofort"
        | "esewa"
        | "paynow"
        | "dpo"
        | "braintree"
        | "powertranz"
        | "sslcommerz"
      payment_status_enum:
        | "pending"
        | "processing"
        | "completed"
        | "failed"
        | "cancelled"
        | "refunded"
        | "disputed"
        | "on_hold"
      refund_status_enum:
        | "requested"
        | "processing"
        | "approved"
        | "completed"
        | "rejected"
        | "cancelled"
      review_sentiment_enum:
        | "very_positive"
        | "positive"
        | "neutral"
        | "negative"
        | "very_negative"
      review_status_enum:
        | "pending"
        | "approved"
        | "rejected"
        | "flagged"
        | "hidden"
      review_type_enum: "listing" | "variation" | "service"
      shipping_account_status_enum:
        | "connected"
        | "disconnected"
        | "pending"
        | "suspended"
        | "expired"
      shipping_provider_enum: "shiprocket" | "pickrr"
      wallet_entry_status_enum: "pending" | "available" | "reversed"
      wallet_entry_type_enum:
        | "cashback"
        | "order_payment"
        | "refund"
        | "adjustment"
        | "topup"
        | "points"
      warehouse_status_enum: "active" | "inactive" | "suspended" | "maintenance"
      warehouse_type_enum:
        | "self"
        | "third_party"
        | "dropship"
        | "fulfillment_center"
    }
    CompositeTypes: {
      http_header: {
        field: string | null
        value: string | null
      }
      http_request: {
        method: unknown
        uri: string | null
        headers: Database["public"]["CompositeTypes"]["http_header"][] | null
        content_type: string | null
        content: string | null
      }
      http_response: {
        status: number | null
        content_type: string | null
        headers: Database["public"]["CompositeTypes"]["http_header"][] | null
        content: string | null
      }
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      app_role: ["admin", "moderator", "user"],
      call_invite_status: ["ringing", "joined", "declined", "missed"],
      call_status: [
        "ringing",
        "active",
        "declined",
        "missed",
        "ended",
        "cancelled",
      ],
      call_type: ["audio", "video"],
      cart_status_enum: ["active", "abandoned", "converted", "expired"],
      category_status_enum: ["A", "D", "H"],
      cms_content_status: [
        "draft",
        "review",
        "scheduled",
        "published",
        "archived",
      ],
      cms_content_type: ["post", "page", "product", "announcement"],
      cms_media_type: ["image", "video", "document", "audio", "other"],
      delivery_status_enum: [
        "pending",
        "ready_to_ship",
        "shipped",
        "in_transit",
        "out_for_delivery",
        "delivered",
        "failed_delivery",
        "returned_to_sender",
        "lost",
        "damaged",
        "cancelled",
      ],
      fulfillment_status_enum: [
        "pending",
        "processing",
        "ready_to_ship",
        "shipped",
        "out_for_delivery",
        "delivered",
        "delivery_failed",
        "returned_to_sender",
        "cancelled",
        "returned",
        "exception",
      ],
      inventory_status_enum: [
        "in_stock",
        "low_stock",
        "out_of_stock",
        "pre_order",
        "discontinued",
      ],
      listing_review_status_enum: [
        "pending",
        "approved",
        "rejected",
        "flagged",
        "hidden",
        "spam",
      ],
      listing_status_enum: [
        "draft",
        "active",
        "paused",
        "sold_out",
        "archived",
      ],
      listing_type_enum: ["physical", "digital", "service"],
      order_status_enum: [
        "pending",
        "awaiting_payment",
        "payment_failed",
        "confirmed",
        "processing",
        "shipped",
        "in_transit",
        "out_for_delivery",
        "delivered",
        "completed",
        "cancelled",
        "refunded",
        "disputed",
        "returned",
        "partially_shipped",
        "on_hold",
        "failed_delivery",
      ],
      payment_account_status_enum: [
        "connected",
        "disconnected",
        "pending",
        "suspended",
        "expired",
      ],
      payment_log_event_type_enum: [
        "success",
        "failure",
        "refund",
        "webhook",
        "capture",
        "authorization",
        "settlement",
        "chargeback",
        "dispute",
      ],
      payment_log_status_enum: [
        "completed",
        "failed",
        "pending",
        "processing",
        "cancelled",
      ],
      payment_mode_enum: [
        "cod",
        "online",
        "bank_transfer",
        "wallet",
        "upi",
        "card",
        "emi",
        "pay_later",
      ],
      payment_provider_enum: [
        "razorpay",
        "paypal",
        "stripe",
        "airwallex",
        "payu",
        "cashfree",
        "phonepe",
        "googlepay",
        "paytm",
        "paystack",
        "mercado",
        "skrill",
        "paymentwall",
        "flutterwave",
        "mollie",
        "coingate",
        "sspay",
        "toyyibpay",
        "paytabs",
        "iyzipay",
        "payfast",
        "benefit",
        "aamarpay",
        "paytr",
        "yookassa",
        "xendit",
        "midtrans",
        "nepalste",
        "khalti",
        "payhere",
        "authorizenet",
        "tap",
        "paddle",
        "paiementpro",
        "fedpay",
        "cinetpay",
        "senagepay",
        "cybersource",
        "ozow",
        "myfatoorah",
        "easebuzz",
        "nmi",
        "sofort",
        "esewa",
        "paynow",
        "dpo",
        "braintree",
        "powertranz",
        "sslcommerz",
      ],
      payment_status_enum: [
        "pending",
        "processing",
        "completed",
        "failed",
        "cancelled",
        "refunded",
        "disputed",
        "on_hold",
      ],
      refund_status_enum: [
        "requested",
        "processing",
        "approved",
        "completed",
        "rejected",
        "cancelled",
      ],
      review_sentiment_enum: [
        "very_positive",
        "positive",
        "neutral",
        "negative",
        "very_negative",
      ],
      review_status_enum: [
        "pending",
        "approved",
        "rejected",
        "flagged",
        "hidden",
      ],
      review_type_enum: ["listing", "variation", "service"],
      shipping_account_status_enum: [
        "connected",
        "disconnected",
        "pending",
        "suspended",
        "expired",
      ],
      shipping_provider_enum: ["shiprocket", "pickrr"],
      wallet_entry_status_enum: ["pending", "available", "reversed"],
      wallet_entry_type_enum: [
        "cashback",
        "order_payment",
        "refund",
        "adjustment",
        "topup",
        "points",
      ],
      warehouse_status_enum: ["active", "inactive", "suspended", "maintenance"],
      warehouse_type_enum: [
        "self",
        "third_party",
        "dropship",
        "fulfillment_center",
      ],
    },
  },
} as const
