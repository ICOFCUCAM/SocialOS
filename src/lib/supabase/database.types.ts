// Generated from the SocialOS Supabase schema (all 21 migrations). Do not edit by hand.
// Regenerate: supabase gen types typescript --local > src/lib/supabase/database.types.ts

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
      audit_events: {
        Row: {
          action: string
          actor_user_id: string | null
          created_at: string
          id: string
          ip_address: unknown
          metadata: Json
          organization_id: string | null
          resource_id: string | null
          resource_type: string
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          created_at?: string
          id?: string
          ip_address?: unknown
          metadata?: Json
          organization_id?: string | null
          resource_id?: string | null
          resource_type: string
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          created_at?: string
          id?: string
          ip_address?: unknown
          metadata?: Json
          organization_id?: string | null
          resource_id?: string | null
          resource_type?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_members: {
        Row: {
          brand_id: string
          created_at: string
          id: string
          organization_id: string
          role: string
          user_id: string
        }
        Insert: {
          brand_id: string
          created_at?: string
          id?: string
          organization_id: string
          role?: string
          user_id: string
        }
        Update: {
          brand_id?: string
          created_at?: string
          id?: string
          organization_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "brand_members_brand_id_organization_id_fkey"
            columns: ["brand_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "brand_members_organization_id_user_id_fkey"
            columns: ["organization_id", "user_id"]
            isOneToOne: false
            referencedRelation: "organization_members"
            referencedColumns: ["organization_id", "user_id"]
          },
        ]
      }
      brands: {
        Row: {
          brand_settings: Json
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          name: string
          organization_id: string
          slug: string
          updated_at: string
          website_url: string | null
        }
        Insert: {
          brand_settings?: Json
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          organization_id: string
          slug: string
          updated_at?: string
          website_url?: string | null
        }
        Update: {
          brand_settings?: Json
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          organization_id?: string
          slug?: string
          updated_at?: string
          website_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "brands_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      media_processing_jobs: {
        Row: {
          asset_id: string
          attempt_count: number
          available_at: string
          completed_at: string | null
          created_at: string
          id: string
          idempotency_key: string
          last_error_code: string | null
          last_error_message: string | null
          locked_at: string | null
          locked_by: string | null
          max_attempts: number
          organization_id: string
          status: Database["public"]["Enums"]["media_processing_job_status"]
          updated_at: string
        }
        Insert: {
          asset_id: string
          attempt_count?: number
          available_at?: string
          completed_at?: string | null
          created_at?: string
          id?: string
          idempotency_key: string
          last_error_code?: string | null
          last_error_message?: string | null
          locked_at?: string | null
          locked_by?: string | null
          max_attempts?: number
          organization_id: string
          status?: Database["public"]["Enums"]["media_processing_job_status"]
          updated_at?: string
        }
        Update: {
          asset_id?: string
          attempt_count?: number
          available_at?: string
          completed_at?: string | null
          created_at?: string
          id?: string
          idempotency_key?: string
          last_error_code?: string | null
          last_error_message?: string | null
          locked_at?: string | null
          locked_by?: string | null
          max_attempts?: number
          organization_id?: string
          status?: Database["public"]["Enums"]["media_processing_job_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "media_processing_jobs_asset_id_organization_id_fkey"
            columns: ["asset_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "social_media_assets"
            referencedColumns: ["id", "organization_id"]
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
          invitation_token_hash: string
          invited_by: string
          organization_id: string
          revoked_at: string | null
          role: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          expires_at: string
          id?: string
          invitation_token_hash: string
          invited_by: string
          organization_id: string
          revoked_at?: string | null
          role: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invitation_token_hash?: string
          invited_by?: string
          organization_id?: string
          revoked_at?: string | null
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_invitations_organization_id_fkey"
            columns: ["organization_id"]
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
          joined_at: string | null
          organization_id: string
          role: string
          status: Database["public"]["Enums"]["member_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          joined_at?: string | null
          organization_id: string
          role?: string
          status?: Database["public"]["Enums"]["member_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          joined_at?: string | null
          organization_id?: string
          role?: string
          status?: Database["public"]["Enums"]["member_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: string
          name: string
          owner_user_id: string
          settings: Json
          slug: string
          status: Database["public"]["Enums"]["organization_status"]
          updated_at: string
          workspace_type: Database["public"]["Enums"]["workspace_type"]
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          name: string
          owner_user_id: string
          settings?: Json
          slug: string
          status?: Database["public"]["Enums"]["organization_status"]
          updated_at?: string
          workspace_type?: Database["public"]["Enums"]["workspace_type"]
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          name?: string
          owner_user_id?: string
          settings?: Json
          slug?: string
          status?: Database["public"]["Enums"]["organization_status"]
          updated_at?: string
          workspace_type?: Database["public"]["Enums"]["workspace_type"]
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          locale: string
          timezone: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          locale?: string
          timezone?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          locale?: string
          timezone?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      publish_job_events: {
        Row: {
          actor_user_id: string | null
          attempt_number: number | null
          created_at: string
          error_code: string | null
          event_type: string
          id: string
          job_id: string
          message: string | null
          metadata: Json
          organization_id: string
          target_id: string
        }
        Insert: {
          actor_user_id?: string | null
          attempt_number?: number | null
          created_at?: string
          error_code?: string | null
          event_type: string
          id?: string
          job_id: string
          message?: string | null
          metadata?: Json
          organization_id: string
          target_id: string
        }
        Update: {
          actor_user_id?: string | null
          attempt_number?: number | null
          created_at?: string
          error_code?: string | null
          event_type?: string
          id?: string
          job_id?: string
          message?: string | null
          metadata?: Json
          organization_id?: string
          target_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "publish_job_events_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "publish_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "publish_job_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "publish_job_events_target_id_fkey"
            columns: ["target_id"]
            isOneToOne: false
            referencedRelation: "social_post_targets"
            referencedColumns: ["id"]
          },
        ]
      }
      publish_jobs: {
        Row: {
          attempt_count: number
          available_at: string
          completed_at: string | null
          created_at: string
          id: string
          idempotency_key: string
          last_error_code: string | null
          last_error_message: string | null
          locked_at: string | null
          locked_by: string | null
          max_attempts: number
          organization_id: string
          post_id: string
          status: Database["public"]["Enums"]["publish_job_status"]
          target_id: string
          updated_at: string
        }
        Insert: {
          attempt_count?: number
          available_at?: string
          completed_at?: string | null
          created_at?: string
          id?: string
          idempotency_key: string
          last_error_code?: string | null
          last_error_message?: string | null
          locked_at?: string | null
          locked_by?: string | null
          max_attempts?: number
          organization_id: string
          post_id: string
          status?: Database["public"]["Enums"]["publish_job_status"]
          target_id: string
          updated_at?: string
        }
        Update: {
          attempt_count?: number
          available_at?: string
          completed_at?: string | null
          created_at?: string
          id?: string
          idempotency_key?: string
          last_error_code?: string | null
          last_error_message?: string | null
          locked_at?: string | null
          locked_by?: string | null
          max_attempts?: number
          organization_id?: string
          post_id?: string
          status?: Database["public"]["Enums"]["publish_job_status"]
          target_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "publish_jobs_post_id_organization_id_fkey"
            columns: ["post_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "social_posts"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "publish_jobs_target_id_organization_id_fkey"
            columns: ["target_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "social_post_targets"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
      publish_organization_fairness: {
        Row: {
          last_claimed_at: string | null
          organization_id: string
          updated_at: string
        }
        Insert: {
          last_claimed_at?: string | null
          organization_id: string
          updated_at?: string
        }
        Update: {
          last_claimed_at?: string | null
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "publish_organization_fairness_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      publish_provider_operations: {
        Row: {
          completed_at: string | null
          created_at: string
          external_permalink: string | null
          external_post_id: string | null
          finalize_started_at: string | null
          id: string
          idempotency_key: string
          job_id: string
          last_error_code: string | null
          last_error_message: string | null
          locked_at: string | null
          locked_by: string | null
          next_action_at: string | null
          operation_type: string
          organization_id: string
          poll_count: number
          provider: string
          remote_operation_id: string | null
          social_account_id: string
          state: string
          submit_started_at: string | null
          submitted_at: string | null
          target_id: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          external_permalink?: string | null
          external_post_id?: string | null
          finalize_started_at?: string | null
          id?: string
          idempotency_key: string
          job_id: string
          last_error_code?: string | null
          last_error_message?: string | null
          locked_at?: string | null
          locked_by?: string | null
          next_action_at?: string | null
          operation_type: string
          organization_id: string
          poll_count?: number
          provider: string
          remote_operation_id?: string | null
          social_account_id: string
          state?: string
          submit_started_at?: string | null
          submitted_at?: string | null
          target_id: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          external_permalink?: string | null
          external_post_id?: string | null
          finalize_started_at?: string | null
          id?: string
          idempotency_key?: string
          job_id?: string
          last_error_code?: string | null
          last_error_message?: string | null
          locked_at?: string | null
          locked_by?: string | null
          next_action_at?: string | null
          operation_type?: string
          organization_id?: string
          poll_count?: number
          provider?: string
          remote_operation_id?: string | null
          social_account_id?: string
          state?: string
          submit_started_at?: string | null
          submitted_at?: string | null
          target_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "publish_provider_operations_job_target_fk"
            columns: ["job_id", "organization_id", "target_id"]
            isOneToOne: false
            referencedRelation: "publish_jobs"
            referencedColumns: ["id", "organization_id", "target_id"]
          },
          {
            foreignKeyName: "publish_provider_operations_target_account_fk"
            columns: ["target_id", "organization_id", "social_account_id"]
            isOneToOne: false
            referencedRelation: "social_post_targets"
            referencedColumns: ["id", "organization_id", "social_account_id"]
          },
        ]
      }
      social_account_tokens: {
        Row: {
          access_token_ciphertext: string
          access_token_expires_at: string | null
          access_token_nonce: string
          access_token_tag: string
          created_at: string
          encryption_algorithm: string
          encryption_key_version: string
          id: string
          last_refreshed_at: string | null
          organization_id: string
          refresh_token_ciphertext: string | null
          refresh_token_expires_at: string | null
          refresh_token_nonce: string | null
          refresh_token_tag: string | null
          social_account_id: string
          token_refresh_locked_at: string | null
          token_refresh_locked_by: string | null
          token_type: string | null
          updated_at: string
        }
        Insert: {
          access_token_ciphertext: string
          access_token_expires_at?: string | null
          access_token_nonce: string
          access_token_tag: string
          created_at?: string
          encryption_algorithm?: string
          encryption_key_version: string
          id?: string
          last_refreshed_at?: string | null
          organization_id: string
          refresh_token_ciphertext?: string | null
          refresh_token_expires_at?: string | null
          refresh_token_nonce?: string | null
          refresh_token_tag?: string | null
          social_account_id: string
          token_refresh_locked_at?: string | null
          token_refresh_locked_by?: string | null
          token_type?: string | null
          updated_at?: string
        }
        Update: {
          access_token_ciphertext?: string
          access_token_expires_at?: string | null
          access_token_nonce?: string
          access_token_tag?: string
          created_at?: string
          encryption_algorithm?: string
          encryption_key_version?: string
          id?: string
          last_refreshed_at?: string | null
          organization_id?: string
          refresh_token_ciphertext?: string | null
          refresh_token_expires_at?: string | null
          refresh_token_nonce?: string | null
          refresh_token_tag?: string | null
          social_account_id?: string
          token_refresh_locked_at?: string | null
          token_refresh_locked_by?: string | null
          token_type?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_account_tokens_social_account_id_organization_id_fkey"
            columns: ["social_account_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "social_accounts"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
      social_accounts: {
        Row: {
          account_name: string
          account_type: string | null
          account_username: string | null
          brand_id: string
          connected_by: string | null
          connection_status: Database["public"]["Enums"]["social_connection_status"]
          created_at: string
          external_account_id: string
          granted_scopes: string[]
          id: string
          last_error: string | null
          last_verified_at: string | null
          metadata: Json
          organization_id: string
          platform_id: string
          profile_image_url: string | null
          updated_at: string
        }
        Insert: {
          account_name: string
          account_type?: string | null
          account_username?: string | null
          brand_id: string
          connected_by?: string | null
          connection_status?: Database["public"]["Enums"]["social_connection_status"]
          created_at?: string
          external_account_id: string
          granted_scopes?: string[]
          id?: string
          last_error?: string | null
          last_verified_at?: string | null
          metadata?: Json
          organization_id: string
          platform_id: string
          profile_image_url?: string | null
          updated_at?: string
        }
        Update: {
          account_name?: string
          account_type?: string | null
          account_username?: string | null
          brand_id?: string
          connected_by?: string | null
          connection_status?: Database["public"]["Enums"]["social_connection_status"]
          created_at?: string
          external_account_id?: string
          granted_scopes?: string[]
          id?: string
          last_error?: string | null
          last_verified_at?: string | null
          metadata?: Json
          organization_id?: string
          platform_id?: string
          profile_image_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_accounts_brand_id_organization_id_fkey"
            columns: ["brand_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "social_accounts_platform_id_fkey"
            columns: ["platform_id"]
            isOneToOne: false
            referencedRelation: "social_platforms"
            referencedColumns: ["id"]
          },
        ]
      }
      social_campaign_posts: {
        Row: {
          added_by: string | null
          campaign_id: string
          created_at: string
          id: string
          organization_id: string
          post_id: string
        }
        Insert: {
          added_by?: string | null
          campaign_id: string
          created_at?: string
          id?: string
          organization_id: string
          post_id: string
        }
        Update: {
          added_by?: string | null
          campaign_id?: string
          created_at?: string
          id?: string
          organization_id?: string
          post_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_campaign_posts_campaign_id_organization_id_fkey"
            columns: ["campaign_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "social_campaigns"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "social_campaign_posts_post_id_organization_id_fkey"
            columns: ["post_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "social_posts"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
      social_campaigns: {
        Row: {
          brand_id: string
          call_to_action: string
          channels: string[]
          content_pillars: string[]
          created_at: string
          created_by: string | null
          description: string
          end_date: string | null
          id: string
          key_message: string
          name: string
          objective: string
          organization_id: string
          start_date: string | null
          status: Database["public"]["Enums"]["social_campaign_status"]
          success_metrics: Json
          target_audience: string
          updated_at: string
        }
        Insert: {
          brand_id: string
          call_to_action?: string
          channels?: string[]
          content_pillars?: string[]
          created_at?: string
          created_by?: string | null
          description?: string
          end_date?: string | null
          id?: string
          key_message?: string
          name: string
          objective?: string
          organization_id: string
          start_date?: string | null
          status?: Database["public"]["Enums"]["social_campaign_status"]
          success_metrics?: Json
          target_audience?: string
          updated_at?: string
        }
        Update: {
          brand_id?: string
          call_to_action?: string
          channels?: string[]
          content_pillars?: string[]
          created_at?: string
          created_by?: string | null
          description?: string
          end_date?: string | null
          id?: string
          key_message?: string
          name?: string
          objective?: string
          organization_id?: string
          start_date?: string | null
          status?: Database["public"]["Enums"]["social_campaign_status"]
          success_metrics?: Json
          target_audience?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_campaigns_brand_id_organization_id_fkey"
            columns: ["brand_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "social_campaigns_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      social_media_assets: {
        Row: {
          brand_id: string
          checksum_sha256: string | null
          created_at: string
          duration_ms: number | null
          file_size_bytes: number
          height: number | null
          id: string
          metadata: Json
          mime_type: string
          organization_id: string
          original_filename: string | null
          processing_status: string
          storage_bucket: string
          storage_object_key: string
          updated_at: string
          uploaded_by: string | null
          width: number | null
        }
        Insert: {
          brand_id: string
          checksum_sha256?: string | null
          created_at?: string
          duration_ms?: number | null
          file_size_bytes: number
          height?: number | null
          id?: string
          metadata?: Json
          mime_type: string
          organization_id: string
          original_filename?: string | null
          processing_status?: string
          storage_bucket: string
          storage_object_key: string
          updated_at?: string
          uploaded_by?: string | null
          width?: number | null
        }
        Update: {
          brand_id?: string
          checksum_sha256?: string | null
          created_at?: string
          duration_ms?: number | null
          file_size_bytes?: number
          height?: number | null
          id?: string
          metadata?: Json
          mime_type?: string
          organization_id?: string
          original_filename?: string | null
          processing_status?: string
          storage_bucket?: string
          storage_object_key?: string
          updated_at?: string
          uploaded_by?: string | null
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "social_media_assets_brand_id_organization_id_fkey"
            columns: ["brand_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "social_media_assets_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      social_platforms: {
        Row: {
          capabilities: Json
          code: string
          created_at: string
          id: string
          is_enabled: boolean
          name: string
        }
        Insert: {
          capabilities?: Json
          code: string
          created_at?: string
          id?: string
          is_enabled?: boolean
          name: string
        }
        Update: {
          capabilities?: Json
          code?: string
          created_at?: string
          id?: string
          is_enabled?: boolean
          name?: string
        }
        Relationships: []
      }
      social_post_analytics_daily: {
        Row: {
          clicks: number | null
          collected_at: string
          comments: number | null
          created_at: string
          engagements: number | null
          followers_gained: number | null
          id: string
          impressions: number | null
          likes: number | null
          metric_date: string
          organization_id: string
          period_type: string
          profile_visits: number | null
          provider_metrics: Json
          reach: number | null
          saves: number | null
          shares: number | null
          target_id: string
          video_views: number | null
        }
        Insert: {
          clicks?: number | null
          collected_at?: string
          comments?: number | null
          created_at?: string
          engagements?: number | null
          followers_gained?: number | null
          id?: string
          impressions?: number | null
          likes?: number | null
          metric_date: string
          organization_id: string
          period_type?: string
          profile_visits?: number | null
          provider_metrics?: Json
          reach?: number | null
          saves?: number | null
          shares?: number | null
          target_id: string
          video_views?: number | null
        }
        Update: {
          clicks?: number | null
          collected_at?: string
          comments?: number | null
          created_at?: string
          engagements?: number | null
          followers_gained?: number | null
          id?: string
          impressions?: number | null
          likes?: number | null
          metric_date?: string
          organization_id?: string
          period_type?: string
          profile_visits?: number | null
          provider_metrics?: Json
          reach?: number | null
          saves?: number | null
          shares?: number | null
          target_id?: string
          video_views?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "social_post_analytics_daily_target_id_organization_id_fkey"
            columns: ["target_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "social_post_targets"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
      social_post_media: {
        Row: {
          alt_text: string | null
          asset_id: string
          created_at: string
          id: string
          organization_id: string
          position: number
          post_id: string
        }
        Insert: {
          alt_text?: string | null
          asset_id: string
          created_at?: string
          id?: string
          organization_id: string
          position?: number
          post_id: string
        }
        Update: {
          alt_text?: string | null
          asset_id?: string
          created_at?: string
          id?: string
          organization_id?: string
          position?: number
          post_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_post_media_asset_id_organization_id_fkey"
            columns: ["asset_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "social_media_assets"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "social_post_media_post_id_organization_id_fkey"
            columns: ["post_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "social_posts"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
      social_post_targets: {
        Row: {
          attempt_count: number
          caption_override: string | null
          created_at: string
          id: string
          last_error_code: string | null
          last_error_message: string | null
          organization_id: string
          platform_options: Json
          platform_permalink: string | null
          platform_post_id: string | null
          post_id: string
          published_at: string | null
          scheduled_at: string | null
          social_account_id: string
          status: Database["public"]["Enums"]["social_post_target_status"]
          updated_at: string
        }
        Insert: {
          attempt_count?: number
          caption_override?: string | null
          created_at?: string
          id?: string
          last_error_code?: string | null
          last_error_message?: string | null
          organization_id: string
          platform_options?: Json
          platform_permalink?: string | null
          platform_post_id?: string | null
          post_id: string
          published_at?: string | null
          scheduled_at?: string | null
          social_account_id: string
          status?: Database["public"]["Enums"]["social_post_target_status"]
          updated_at?: string
        }
        Update: {
          attempt_count?: number
          caption_override?: string | null
          created_at?: string
          id?: string
          last_error_code?: string | null
          last_error_message?: string | null
          organization_id?: string
          platform_options?: Json
          platform_permalink?: string | null
          platform_post_id?: string | null
          post_id?: string
          published_at?: string | null
          scheduled_at?: string | null
          social_account_id?: string
          status?: Database["public"]["Enums"]["social_post_target_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_post_targets_post_id_organization_id_fkey"
            columns: ["post_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "social_posts"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "social_post_targets_social_account_id_organization_id_fkey"
            columns: ["social_account_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "social_accounts"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
      social_post_version_media: {
        Row: {
          alt_text: string | null
          asset_id: string
          created_at: string
          id: string
          organization_id: string
          position: number
          version_id: string
        }
        Insert: {
          alt_text?: string | null
          asset_id: string
          created_at?: string
          id?: string
          organization_id: string
          position?: number
          version_id: string
        }
        Update: {
          alt_text?: string | null
          asset_id?: string
          created_at?: string
          id?: string
          organization_id?: string
          position?: number
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_post_version_media_asset_id_organization_id_fkey"
            columns: ["asset_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "social_media_assets"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "social_post_version_media_version_id_organization_id_fkey"
            columns: ["version_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "social_post_versions"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
      social_post_versions: {
        Row: {
          body: string
          created_at: string
          id: string
          is_default: boolean
          organization_id: string
          platform_options: Json
          post_id: string
          social_account_id: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          body?: string
          created_at?: string
          id?: string
          is_default?: boolean
          organization_id: string
          platform_options?: Json
          post_id: string
          social_account_id?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          is_default?: boolean
          organization_id?: string
          platform_options?: Json
          post_id?: string
          social_account_id?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_post_versions_post_id_organization_id_fkey"
            columns: ["post_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "social_posts"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "social_post_versions_social_account_id_organization_id_fkey"
            columns: ["social_account_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "social_accounts"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
      social_posts: {
        Row: {
          body: string
          brand_id: string
          cancelled_at: string | null
          created_at: string
          created_by: string | null
          id: string
          last_error_code: string | null
          last_error_message: string | null
          metadata: Json
          organization_id: string
          published_at: string | null
          scheduled_at: string | null
          status: Database["public"]["Enums"]["social_post_status"]
          timezone: string
          title: string | null
          updated_at: string
        }
        Insert: {
          body?: string
          brand_id: string
          cancelled_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          last_error_code?: string | null
          last_error_message?: string | null
          metadata?: Json
          organization_id: string
          published_at?: string | null
          scheduled_at?: string | null
          status?: Database["public"]["Enums"]["social_post_status"]
          timezone?: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          body?: string
          brand_id?: string
          cancelled_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          last_error_code?: string | null
          last_error_message?: string | null
          metadata?: Json
          organization_id?: string
          published_at?: string | null
          scheduled_at?: string | null
          status?: Database["public"]["Enums"]["social_post_status"]
          timezone?: string
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_posts_brand_id_organization_id_fkey"
            columns: ["brand_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "social_posts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      attach_post_to_campaign: {
        Args: { p_campaign_id: string; p_post_id: string }
        Returns: boolean
      }
      claim_due_publish_provider_operations: {
        Args: {
          p_lease_seconds?: number
          p_limit?: number
          p_worker_id: string
        }
        Returns: {
          completed_at: string | null
          created_at: string
          external_permalink: string | null
          external_post_id: string | null
          finalize_started_at: string | null
          id: string
          idempotency_key: string
          job_id: string
          last_error_code: string | null
          last_error_message: string | null
          locked_at: string | null
          locked_by: string | null
          next_action_at: string | null
          operation_type: string
          organization_id: string
          poll_count: number
          provider: string
          remote_operation_id: string | null
          social_account_id: string
          state: string
          submit_started_at: string | null
          submitted_at: string | null
          target_id: string
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "publish_provider_operations"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      claim_media_processing_jobs: {
        Args: { p_limit?: number; p_worker_id: string }
        Returns: {
          asset_id: string
          attempt_count: number
          available_at: string
          completed_at: string | null
          created_at: string
          id: string
          idempotency_key: string
          last_error_code: string | null
          last_error_message: string | null
          locked_at: string | null
          locked_by: string | null
          max_attempts: number
          organization_id: string
          status: Database["public"]["Enums"]["media_processing_job_status"]
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "media_processing_jobs"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      claim_publish_jobs:
        | {
            Args: { p_limit?: number; p_worker_id: string }
            Returns: {
              attempt_count: number
              available_at: string
              completed_at: string | null
              created_at: string
              id: string
              idempotency_key: string
              last_error_code: string | null
              last_error_message: string | null
              locked_at: string | null
              locked_by: string | null
              max_attempts: number
              organization_id: string
              post_id: string
              status: Database["public"]["Enums"]["publish_job_status"]
              target_id: string
              updated_at: string
            }[]
            SetofOptions: {
              from: "*"
              to: "publish_jobs"
              isOneToOne: false
              isSetofReturn: true
            }
          }
        | {
            Args: {
              p_limit: number
              p_org_concurrency_limit: number
              p_worker_id: string
            }
            Returns: {
              attempt_count: number
              available_at: string
              completed_at: string | null
              created_at: string
              id: string
              idempotency_key: string
              last_error_code: string | null
              last_error_message: string | null
              locked_at: string | null
              locked_by: string | null
              max_attempts: number
              organization_id: string
              post_id: string
              status: Database["public"]["Enums"]["publish_job_status"]
              target_id: string
              updated_at: string
            }[]
            SetofOptions: {
              from: "*"
              to: "publish_jobs"
              isOneToOne: false
              isSetofReturn: true
            }
          }
      claim_social_token_refresh: {
        Args: {
          p_social_account_id: string
          p_stale_after_seconds?: number
          p_worker_id: string
        }
        Returns: boolean
      }
      create_customer_organization: {
        Args: { p_name: string; p_slug: string }
        Returns: string
      }
      create_social_campaign: { Args: { p_payload: Json }; Returns: string }
      create_social_post_bundle: { Args: { p_payload: Json }; Returns: string }
      create_social_post_bundle_with_versions: {
        Args: { p_payload: Json }
        Returns: string
      }
      disconnect_social_account: {
        Args: {
          p_account_id: string
          p_actor_user_id: string
          p_organization_id: string
        }
        Returns: boolean
      }
      finalize_publish_provider_operation: {
        Args: {
          p_external_post_id: string
          p_operation_id: string
          p_permalink?: string
          p_worker_id: string
        }
        Returns: undefined
      }
      get_publishing_operations_summary: {
        Args: { p_organization_id: string }
        Returns: {
          dead_letter_count: number
          dead_lettered_24h: number
          oldest_due_at: string
          queued_count: number
          retry_count: number
          running_count: number
          succeeded_24h: number
        }[]
      }
      operator_reconcile_publish_job: {
        Args: {
          p_external_post_id: string
          p_job_id: string
          p_permalink?: string
        }
        Returns: undefined
      }
      operator_retry_publish_job: {
        Args: { p_job_id: string }
        Returns: undefined
      }
      recover_stale_media_processing_jobs: {
        Args: { p_lease_minutes?: number }
        Returns: number
      }
      recover_stale_publish_jobs: {
        Args: { p_lease_minutes?: number }
        Returns: number
      }
      recover_stale_publish_provider_operations: {
        Args: { p_lease_seconds?: number }
        Returns: number
      }
      release_social_token_refresh: {
        Args: { p_social_account_id: string; p_worker_id: string }
        Returns: boolean
      }
      retry_publish_job: {
        Args: {
          p_actor_user_id: string
          p_job_id: string
          p_organization_id: string
        }
        Returns: boolean
      }
      update_social_campaign: {
        Args: { p_campaign_id: string; p_payload: Json }
        Returns: boolean
      }
    }
    Enums: {
      media_processing_job_status:
        | "queued"
        | "running"
        | "retry"
        | "succeeded"
        | "failed"
        | "dead_letter"
      member_status: "active" | "invited" | "suspended" | "removed"
      organization_status: "active" | "suspended" | "pending_deletion"
      publish_job_status:
        | "queued"
        | "running"
        | "retry"
        | "succeeded"
        | "dead_letter"
        | "cancelled"
        | "awaiting_provider"
      social_campaign_status:
        | "draft"
        | "planned"
        | "active"
        | "paused"
        | "completed"
        | "archived"
      social_connection_status:
        | "pending"
        | "connected"
        | "expired"
        | "reauthorization_required"
        | "disconnected"
        | "error"
      social_post_status:
        | "draft"
        | "scheduled"
        | "processing"
        | "published"
        | "partially_published"
        | "failed"
        | "cancelled"
      social_post_target_status:
        | "pending"
        | "queued"
        | "publishing"
        | "published"
        | "failed"
        | "skipped"
        | "cancelled"
      workspace_type: "internal" | "customer"
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
      media_processing_job_status: [
        "queued",
        "running",
        "retry",
        "succeeded",
        "failed",
        "dead_letter",
      ],
      member_status: ["active", "invited", "suspended", "removed"],
      organization_status: ["active", "suspended", "pending_deletion"],
      publish_job_status: [
        "queued",
        "running",
        "retry",
        "succeeded",
        "dead_letter",
        "cancelled",
        "awaiting_provider",
      ],
      social_campaign_status: [
        "draft",
        "planned",
        "active",
        "paused",
        "completed",
        "archived",
      ],
      social_connection_status: [
        "pending",
        "connected",
        "expired",
        "reauthorization_required",
        "disconnected",
        "error",
      ],
      social_post_status: [
        "draft",
        "scheduled",
        "processing",
        "published",
        "partially_published",
        "failed",
        "cancelled",
      ],
      social_post_target_status: [
        "pending",
        "queued",
        "publishing",
        "published",
        "failed",
        "skipped",
        "cancelled",
      ],
      workspace_type: ["internal", "customer"],
    },
  },
} as const
