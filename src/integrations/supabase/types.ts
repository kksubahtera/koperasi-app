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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      account_claim_tokens: {
        Row: {
          claimed_at: string | null
          created_at: string | null
          expires_at: string
          id: string
          ip_address: string | null
          token: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          claimed_at?: string | null
          created_at?: string | null
          expires_at: string
          id?: string
          ip_address?: string | null
          token: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          claimed_at?: string | null
          created_at?: string | null
          expires_at?: string
          id?: string
          ip_address?: string | null
          token?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      admin_activity_logs: {
        Row: {
          action_type: string
          admin_user_id: string
          created_at: string | null
          description: string
          id: string
          ip_address: string | null
          metadata: Json | null
          target_entity: string | null
          target_id: string | null
          user_agent: string | null
        }
        Insert: {
          action_type: string
          admin_user_id: string
          created_at?: string | null
          description: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          target_entity?: string | null
          target_id?: string | null
          user_agent?: string | null
        }
        Update: {
          action_type?: string
          admin_user_id?: string
          created_at?: string | null
          description?: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          target_entity?: string | null
          target_id?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      admin_notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          message: string
          metadata: Json | null
          notification_type: string
          read_at: string | null
          read_by: string | null
          title: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          message: string
          metadata?: Json | null
          notification_type: string
          read_at?: string | null
          read_by?: string | null
          title: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          metadata?: Json | null
          notification_type?: string
          read_at?: string | null
          read_by?: string | null
          title?: string
        }
        Relationships: []
      }
      admin_permissions: {
        Row: {
          admin_role: string | null
          can_approve_transactions: boolean | null
          can_export_data: boolean | null
          can_manage_accounting: boolean | null
          can_manage_admins: boolean | null
          can_manage_corrections: boolean | null
          can_manage_loans: boolean | null
          can_manage_members: boolean | null
          can_manage_registrations: boolean | null
          can_manage_resignations: boolean | null
          can_manage_settings: boolean | null
          can_view_audit_logs: boolean | null
          can_view_reports: boolean | null
          created_at: string | null
          id: string
          updated_at: string | null
          updated_by: string | null
          user_id: string
        }
        Insert: {
          admin_role?: string | null
          can_approve_transactions?: boolean | null
          can_export_data?: boolean | null
          can_manage_accounting?: boolean | null
          can_manage_admins?: boolean | null
          can_manage_corrections?: boolean | null
          can_manage_loans?: boolean | null
          can_manage_members?: boolean | null
          can_manage_registrations?: boolean | null
          can_manage_resignations?: boolean | null
          can_manage_settings?: boolean | null
          can_view_audit_logs?: boolean | null
          can_view_reports?: boolean | null
          created_at?: string | null
          id?: string
          updated_at?: string | null
          updated_by?: string | null
          user_id: string
        }
        Update: {
          admin_role?: string | null
          can_approve_transactions?: boolean | null
          can_export_data?: boolean | null
          can_manage_accounting?: boolean | null
          can_manage_admins?: boolean | null
          can_manage_corrections?: boolean | null
          can_manage_loans?: boolean | null
          can_manage_members?: boolean | null
          can_manage_registrations?: boolean | null
          can_manage_resignations?: boolean | null
          can_manage_settings?: boolean | null
          can_view_audit_logs?: boolean | null
          can_view_reports?: boolean | null
          created_at?: string | null
          id?: string
          updated_at?: string | null
          updated_by?: string | null
          user_id?: string
        }
        Relationships: []
      }
      archived_accounts: {
        Row: {
          address: string | null
          archive_reason: string
          archived_at: string
          archived_by: string | null
          bank_account_name: string | null
          bank_account_number: string | null
          bank_name: string | null
          branch_id: string | null
          days_since_creation: number | null
          email: string | null
          id: string
          join_date: string | null
          member_number: string | null
          name: string
          nik: string | null
          original_loans_data: Json | null
          original_profile_data: Json | null
          original_savings_data: Json | null
          original_transactions_data: Json | null
          original_user_id: string
          outstanding_loan: number | null
          phone: string | null
          simpanan_pokok: number | null
          simpanan_sukarela: number | null
          simpanan_wajib: number | null
          total_simpanan: number | null
          was_claimed: boolean | null
        }
        Insert: {
          address?: string | null
          archive_reason: string
          archived_at?: string
          archived_by?: string | null
          bank_account_name?: string | null
          bank_account_number?: string | null
          bank_name?: string | null
          branch_id?: string | null
          days_since_creation?: number | null
          email?: string | null
          id?: string
          join_date?: string | null
          member_number?: string | null
          name: string
          nik?: string | null
          original_loans_data?: Json | null
          original_profile_data?: Json | null
          original_savings_data?: Json | null
          original_transactions_data?: Json | null
          original_user_id: string
          outstanding_loan?: number | null
          phone?: string | null
          simpanan_pokok?: number | null
          simpanan_sukarela?: number | null
          simpanan_wajib?: number | null
          total_simpanan?: number | null
          was_claimed?: boolean | null
        }
        Update: {
          address?: string | null
          archive_reason?: string
          archived_at?: string
          archived_by?: string | null
          bank_account_name?: string | null
          bank_account_number?: string | null
          bank_name?: string | null
          branch_id?: string | null
          days_since_creation?: number | null
          email?: string | null
          id?: string
          join_date?: string | null
          member_number?: string | null
          name?: string
          nik?: string | null
          original_loans_data?: Json | null
          original_profile_data?: Json | null
          original_savings_data?: Json | null
          original_transactions_data?: Json | null
          original_user_id?: string
          outstanding_loan?: number | null
          phone?: string | null
          simpanan_pokok?: number | null
          simpanan_sukarela?: number | null
          simpanan_wajib?: number | null
          total_simpanan?: number | null
          was_claimed?: boolean | null
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action_type: string
          created_at: string
          description: string
          entity_id: string | null
          entity_type: string
          id: string
          ip_address: string | null
          metadata: Json | null
          new_data: Json | null
          old_data: Json | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          action_type: string
          created_at?: string
          description: string
          entity_id?: string | null
          entity_type: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          new_data?: Json | null
          old_data?: Json | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          action_type?: string
          created_at?: string
          description?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          new_data?: Json | null
          old_data?: Json | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      balance_sheets: {
        Row: {
          bank: number
          barang_dagang: number
          created_at: string
          dana_cadangan: number
          dana_pembangunan: number
          dana_pendidikan: number
          dana_sosial: number
          hibah_donasi: number
          id: string
          kas: number
          modal_penyertaan: number
          modal_pinjaman: number
          penambahan_dana_cadangan: number
          penambahan_dana_pembangunan: number
          penambahan_dana_pendidikan: number
          penambahan_dana_sosial: number
          penambahan_hibah_donasi: number
          penambahan_modal_penyertaan: number
          penambahan_modal_pinjaman: number
          penambahan_simpanan_pokok: number
          penambahan_simpanan_sukarela: number
          penambahan_simpanan_wajib: number
          pengurangan_dana_cadangan: number
          pengurangan_dana_pembangunan: number
          pengurangan_dana_pendidikan: number
          pengurangan_dana_sosial: number
          pengurangan_hibah_donasi: number
          pengurangan_modal_penyertaan: number
          pengurangan_modal_pinjaman: number
          pengurangan_simpanan_pokok: number
          pengurangan_simpanan_sukarela: number
          pengurangan_simpanan_wajib: number
          piutang: number
          rolled_by: string | null
          rolled_from_year: number | null
          rollover_date: string | null
          rollover_journal_id: string | null
          saldo_awal_dana_cadangan: number
          saldo_awal_dana_pembangunan: number
          saldo_awal_dana_pendidikan: number
          saldo_awal_dana_sosial: number
          saldo_awal_hibah_donasi: number
          saldo_awal_modal_penyertaan: number
          saldo_awal_modal_pinjaman: number
          saldo_awal_simpanan_pokok: number
          saldo_awal_simpanan_sukarela: number
          saldo_awal_simpanan_wajib: number
          shu_withheld_balance: number
          simpanan_pokok: number
          simpanan_sukarela: number
          simpanan_wajib: number
          surat_berharga: number
          total_assets: number
          total_equity: number
          total_penambahan: number
          total_pengurangan: number
          total_saldo_awal: number
          updated_at: string
          year: number
        }
        Insert: {
          bank?: number
          barang_dagang?: number
          created_at?: string
          dana_cadangan?: number
          dana_pembangunan?: number
          dana_pendidikan?: number
          dana_sosial?: number
          hibah_donasi?: number
          id?: string
          kas?: number
          modal_penyertaan?: number
          modal_pinjaman?: number
          penambahan_dana_cadangan?: number
          penambahan_dana_pembangunan?: number
          penambahan_dana_pendidikan?: number
          penambahan_dana_sosial?: number
          penambahan_hibah_donasi?: number
          penambahan_modal_penyertaan?: number
          penambahan_modal_pinjaman?: number
          penambahan_simpanan_pokok?: number
          penambahan_simpanan_sukarela?: number
          penambahan_simpanan_wajib?: number
          pengurangan_dana_cadangan?: number
          pengurangan_dana_pembangunan?: number
          pengurangan_dana_pendidikan?: number
          pengurangan_dana_sosial?: number
          pengurangan_hibah_donasi?: number
          pengurangan_modal_penyertaan?: number
          pengurangan_modal_pinjaman?: number
          pengurangan_simpanan_pokok?: number
          pengurangan_simpanan_sukarela?: number
          pengurangan_simpanan_wajib?: number
          piutang?: number
          rolled_by?: string | null
          rolled_from_year?: number | null
          rollover_date?: string | null
          rollover_journal_id?: string | null
          saldo_awal_dana_cadangan?: number
          saldo_awal_dana_pembangunan?: number
          saldo_awal_dana_pendidikan?: number
          saldo_awal_dana_sosial?: number
          saldo_awal_hibah_donasi?: number
          saldo_awal_modal_penyertaan?: number
          saldo_awal_modal_pinjaman?: number
          saldo_awal_simpanan_pokok?: number
          saldo_awal_simpanan_sukarela?: number
          saldo_awal_simpanan_wajib?: number
          shu_withheld_balance?: number
          simpanan_pokok?: number
          simpanan_sukarela?: number
          simpanan_wajib?: number
          surat_berharga?: number
          total_assets?: number
          total_equity?: number
          total_penambahan?: number
          total_pengurangan?: number
          total_saldo_awal?: number
          updated_at?: string
          year: number
        }
        Update: {
          bank?: number
          barang_dagang?: number
          created_at?: string
          dana_cadangan?: number
          dana_pembangunan?: number
          dana_pendidikan?: number
          dana_sosial?: number
          hibah_donasi?: number
          id?: string
          kas?: number
          modal_penyertaan?: number
          modal_pinjaman?: number
          penambahan_dana_cadangan?: number
          penambahan_dana_pembangunan?: number
          penambahan_dana_pendidikan?: number
          penambahan_dana_sosial?: number
          penambahan_hibah_donasi?: number
          penambahan_modal_penyertaan?: number
          penambahan_modal_pinjaman?: number
          penambahan_simpanan_pokok?: number
          penambahan_simpanan_sukarela?: number
          penambahan_simpanan_wajib?: number
          pengurangan_dana_cadangan?: number
          pengurangan_dana_pembangunan?: number
          pengurangan_dana_pendidikan?: number
          pengurangan_dana_sosial?: number
          pengurangan_hibah_donasi?: number
          pengurangan_modal_penyertaan?: number
          pengurangan_modal_pinjaman?: number
          pengurangan_simpanan_pokok?: number
          pengurangan_simpanan_sukarela?: number
          pengurangan_simpanan_wajib?: number
          piutang?: number
          rolled_by?: string | null
          rolled_from_year?: number | null
          rollover_date?: string | null
          rollover_journal_id?: string | null
          saldo_awal_dana_cadangan?: number
          saldo_awal_dana_pembangunan?: number
          saldo_awal_dana_pendidikan?: number
          saldo_awal_dana_sosial?: number
          saldo_awal_hibah_donasi?: number
          saldo_awal_modal_penyertaan?: number
          saldo_awal_modal_pinjaman?: number
          saldo_awal_simpanan_pokok?: number
          saldo_awal_simpanan_sukarela?: number
          saldo_awal_simpanan_wajib?: number
          shu_withheld_balance?: number
          simpanan_pokok?: number
          simpanan_sukarela?: number
          simpanan_wajib?: number
          surat_berharga?: number
          total_assets?: number
          total_equity?: number
          total_penambahan?: number
          total_pengurangan?: number
          total_saldo_awal?: number
          updated_at?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "balance_sheets_rollover_journal_id_fkey"
            columns: ["rollover_journal_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_reconciliations: {
        Row: {
          adjusted_bank_balance: number
          adjusted_book_balance: number
          bank_statement_balance: number
          book_balance: number
          created_at: string
          created_by: string | null
          difference: number
          id: string
          is_reconciled: boolean
          notes: string | null
          outstanding_items: Json
          period_month: number
          period_year: number
          reconciliation_date: string
          updated_at: string
        }
        Insert: {
          adjusted_bank_balance?: number
          adjusted_book_balance?: number
          bank_statement_balance?: number
          book_balance?: number
          created_at?: string
          created_by?: string | null
          difference?: number
          id?: string
          is_reconciled?: boolean
          notes?: string | null
          outstanding_items?: Json
          period_month: number
          period_year: number
          reconciliation_date: string
          updated_at?: string
        }
        Update: {
          adjusted_bank_balance?: number
          adjusted_book_balance?: number
          bank_statement_balance?: number
          book_balance?: number
          created_at?: string
          created_by?: string | null
          difference?: number
          id?: string
          is_reconciled?: boolean
          notes?: string | null
          outstanding_items?: Json
          period_month?: number
          period_year?: number
          reconciliation_date?: string
          updated_at?: string
        }
        Relationships: []
      }
      business_unit_transactions: {
        Row: {
          amount: number
          business_unit_id: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_member_transaction: boolean
          notes: string | null
          quantity: number | null
          transaction_date: string
          transaction_type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          business_unit_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_member_transaction?: boolean
          notes?: string | null
          quantity?: number | null
          transaction_date?: string
          transaction_type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          business_unit_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_member_transaction?: boolean
          notes?: string | null
          quantity?: number | null
          transaction_date?: string
          transaction_type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_unit_transactions_business_unit_id_fkey"
            columns: ["business_unit_id"]
            isOneToOne: false
            referencedRelation: "business_units"
            referencedColumns: ["id"]
          },
        ]
      }
      business_units: {
        Row: {
          code: string
          created_at: string
          description: string | null
          display_order: number | null
          id: string
          is_active: boolean
          is_primary: boolean
          name: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean
          is_primary?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean
          is_primary?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      chart_of_accounts: {
        Row: {
          account_code: string
          account_name: string
          account_type: Database["public"]["Enums"]["account_type"]
          balance: number
          business_unit_id: string | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          is_system: boolean
          parent_id: string | null
          updated_at: string
        }
        Insert: {
          account_code: string
          account_name: string
          account_type: Database["public"]["Enums"]["account_type"]
          balance?: number
          business_unit_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_system?: boolean
          parent_id?: string | null
          updated_at?: string
        }
        Update: {
          account_code?: string
          account_name?: string
          account_type?: Database["public"]["Enums"]["account_type"]
          balance?: number
          business_unit_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_system?: boolean
          parent_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chart_of_accounts_business_unit_id_fkey"
            columns: ["business_unit_id"]
            isOneToOne: false
            referencedRelation: "business_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chart_of_accounts_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      cooperative_announcements: {
        Row: {
          announcement_type: string
          created_at: string
          created_by: string | null
          email_sent_count: number | null
          id: string
          is_email_sent: boolean | null
          message: string
          notification_sent_count: number | null
          target_type: string
          target_user_ids: string[] | null
          title: string
          updated_at: string
        }
        Insert: {
          announcement_type?: string
          created_at?: string
          created_by?: string | null
          email_sent_count?: number | null
          id?: string
          is_email_sent?: boolean | null
          message: string
          notification_sent_count?: number | null
          target_type?: string
          target_user_ids?: string[] | null
          title: string
          updated_at?: string
        }
        Update: {
          announcement_type?: string
          created_at?: string
          created_by?: string | null
          email_sent_count?: number | null
          id?: string
          is_email_sent?: boolean | null
          message?: string
          notification_sent_count?: number | null
          target_type?: string
          target_user_ids?: string[] | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      cooperative_books: {
        Row: {
          book_code: string
          book_name: string
          book_type: string
          business_unit_id: string | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          updated_at: string
        }
        Insert: {
          book_code: string
          book_name: string
          book_type: string
          business_unit_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          updated_at?: string
        }
        Update: {
          book_code?: string
          book_name?: string
          book_type?: string
          business_unit_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cooperative_books_business_unit_id_fkey"
            columns: ["business_unit_id"]
            isOneToOne: false
            referencedRelation: "business_units"
            referencedColumns: ["id"]
          },
        ]
      }
      cooperative_branches: {
        Row: {
          badge_color: string | null
          code: string
          created_at: string | null
          description: string | null
          display_order: number | null
          id: string
          is_active: boolean | null
          name: string
          updated_at: string | null
        }
        Insert: {
          badge_color?: string | null
          code: string
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          name: string
          updated_at?: string | null
        }
        Update: {
          badge_color?: string | null
          code?: string
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      cooperative_settings: {
        Row: {
          id: string
          key: string
          updated_at: string | null
          updated_by: string | null
          value: Json
        }
        Insert: {
          id?: string
          key: string
          updated_at?: string | null
          updated_by?: string | null
          value: Json
        }
        Update: {
          id?: string
          key?: string
          updated_at?: string | null
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      corrections: {
        Row: {
          amount: number
          correction_mode: string | null
          correction_type: string
          created_at: string
          created_by: string | null
          current_balance: number
          footnote: string | null
          id: string
          installment_id: string | null
          installment_number: number | null
          journal_entry_id: string | null
          new_balance: number
          operation: string
          reason: string
          report_reason: string | null
          reported_at: string | null
          resolution_note: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: string
          transaction_id: string | null
          user_id: string
        }
        Insert: {
          amount: number
          correction_mode?: string | null
          correction_type: string
          created_at?: string
          created_by?: string | null
          current_balance: number
          footnote?: string | null
          id?: string
          installment_id?: string | null
          installment_number?: number | null
          journal_entry_id?: string | null
          new_balance: number
          operation: string
          reason: string
          report_reason?: string | null
          reported_at?: string | null
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          transaction_id?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          correction_mode?: string | null
          correction_type?: string
          created_at?: string
          created_by?: string | null
          current_balance?: number
          footnote?: string | null
          id?: string
          installment_id?: string | null
          installment_number?: number | null
          journal_entry_id?: string | null
          new_balance?: number
          operation?: string
          reason?: string
          report_reason?: string | null
          reported_at?: string | null
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          transaction_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "corrections_installment_id_fkey"
            columns: ["installment_id"]
            isOneToOne: false
            referencedRelation: "loan_installments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "corrections_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "corrections_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      data_backups: {
        Row: {
          backup_type: string
          created_at: string
          created_by: string | null
          file_name: string
          file_size: number | null
          id: string
          metadata: Json | null
          notes: string | null
          record_count: number | null
          status: string
        }
        Insert: {
          backup_type: string
          created_at?: string
          created_by?: string | null
          file_name: string
          file_size?: number | null
          id?: string
          metadata?: Json | null
          notes?: string | null
          record_count?: number | null
          status?: string
        }
        Update: {
          backup_type?: string
          created_at?: string
          created_by?: string | null
          file_name?: string
          file_size?: number | null
          id?: string
          metadata?: Json | null
          notes?: string | null
          record_count?: number | null
          status?: string
        }
        Relationships: []
      }
      email_change_logs: {
        Row: {
          changed_at: string | null
          id: string
          ip_address: string | null
          new_email: string
          old_email: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          changed_at?: string | null
          id?: string
          ip_address?: string | null
          new_email: string
          old_email: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          changed_at?: string | null
          id?: string
          ip_address?: string | null
          new_email?: string
          old_email?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      exited_member_shu_payments: {
        Row: {
          active_months: number
          base_jasa_usaha_share: number
          base_simpanan_share: number
          calculation_method: string
          created_at: string
          created_by: string | null
          exit_date: string
          final_jasa_usaha_share: number
          final_simpanan_share: number
          id: string
          join_date: string | null
          member_name: string
          member_number: string | null
          payment_date: string | null
          payment_method: string | null
          payment_note: string | null
          payment_status: string
          proportion_factor: number
          total_jasa_usaha: number
          total_months: number
          total_shu_amount: number
          total_simpanan: number
          updated_at: string
          updated_by: string | null
          user_id: string
          year: number
        }
        Insert: {
          active_months?: number
          base_jasa_usaha_share?: number
          base_simpanan_share?: number
          calculation_method?: string
          created_at?: string
          created_by?: string | null
          exit_date: string
          final_jasa_usaha_share?: number
          final_simpanan_share?: number
          id?: string
          join_date?: string | null
          member_name: string
          member_number?: string | null
          payment_date?: string | null
          payment_method?: string | null
          payment_note?: string | null
          payment_status?: string
          proportion_factor?: number
          total_jasa_usaha?: number
          total_months?: number
          total_shu_amount?: number
          total_simpanan?: number
          updated_at?: string
          updated_by?: string | null
          user_id: string
          year: number
        }
        Update: {
          active_months?: number
          base_jasa_usaha_share?: number
          base_simpanan_share?: number
          calculation_method?: string
          created_at?: string
          created_by?: string | null
          exit_date?: string
          final_jasa_usaha_share?: number
          final_simpanan_share?: number
          id?: string
          join_date?: string | null
          member_name?: string
          member_number?: string | null
          payment_date?: string | null
          payment_method?: string | null
          payment_note?: string | null
          payment_status?: string
          proportion_factor?: number
          total_jasa_usaha?: number
          total_months?: number
          total_shu_amount?: number
          total_simpanan?: number
          updated_at?: string
          updated_by?: string | null
          user_id?: string
          year?: number
        }
        Relationships: []
      }
      expense_entries: {
        Row: {
          amount: number
          created_at: string
          date: string
          description: string
          id: string
          type: string
          updated_at: string
          year: number
        }
        Insert: {
          amount: number
          created_at?: string
          date?: string
          description: string
          id?: string
          type?: string
          updated_at?: string
          year: number
        }
        Update: {
          amount?: number
          created_at?: string
          date?: string
          description?: string
          id?: string
          type?: string
          updated_at?: string
          year?: number
        }
        Relationships: []
      }
      fixed_assets: {
        Row: {
          accumulated_depreciation: number
          acquisition_cost: number
          acquisition_date: string
          asset_code: string
          asset_name: string
          category: string | null
          created_at: string
          current_value: number
          depreciation_method: string
          id: string
          location: string | null
          status: string
          updated_at: string
          useful_life_months: number
        }
        Insert: {
          accumulated_depreciation?: number
          acquisition_cost: number
          acquisition_date: string
          asset_code: string
          asset_name: string
          category?: string | null
          created_at?: string
          current_value?: number
          depreciation_method?: string
          id?: string
          location?: string | null
          status?: string
          updated_at?: string
          useful_life_months?: number
        }
        Update: {
          accumulated_depreciation?: number
          acquisition_cost?: number
          acquisition_date?: string
          asset_code?: string
          asset_name?: string
          category?: string | null
          created_at?: string
          current_value?: number
          depreciation_method?: string
          id?: string
          location?: string | null
          status?: string
          updated_at?: string
          useful_life_months?: number
        }
        Relationships: []
      }
      income_entries: {
        Row: {
          amount: number
          created_at: string
          date: string
          description: string
          id: string
          type: string
          updated_at: string
          year: number
        }
        Insert: {
          amount: number
          created_at?: string
          date?: string
          description: string
          id?: string
          type?: string
          updated_at?: string
          year: number
        }
        Update: {
          amount?: number
          created_at?: string
          date?: string
          description?: string
          id?: string
          type?: string
          updated_at?: string
          year?: number
        }
        Relationships: []
      }
      interest_notifications: {
        Row: {
          created_at: string
          eligible_balance: number
          id: string
          interest_amount: number
          interest_rate: number
          is_read: boolean
          period: string
          period_name: string
          read_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          eligible_balance?: number
          id?: string
          interest_amount?: number
          interest_rate?: number
          is_read?: boolean
          period: string
          period_name: string
          read_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          eligible_balance?: number
          id?: string
          interest_amount?: number
          interest_rate?: number
          is_read?: boolean
          period?: string
          period_name?: string
          read_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      inventory_items: {
        Row: {
          business_unit_id: string | null
          category: string | null
          created_at: string
          id: string
          is_active: boolean
          item_code: string
          item_name: string
          min_stock: number
          quantity: number
          unit: string
          unit_cost: number
          unit_price: number
          updated_at: string
        }
        Insert: {
          business_unit_id?: string | null
          category?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          item_code: string
          item_name: string
          min_stock?: number
          quantity?: number
          unit?: string
          unit_cost?: number
          unit_price?: number
          updated_at?: string
        }
        Update: {
          business_unit_id?: string | null
          category?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          item_code?: string
          item_name?: string
          min_stock?: number
          quantity?: number
          unit?: string
          unit_cost?: number
          unit_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_items_business_unit_id_fkey"
            columns: ["business_unit_id"]
            isOneToOne: false
            referencedRelation: "business_units"
            referencedColumns: ["id"]
          },
        ]
      }
      issued_letters: {
        Row: {
          created_at: string
          id: string
          issued_by: string | null
          issued_date: string
          letter_number: string
          letter_type: string
          member_name: string
          member_number: string | null
          metadata: Json | null
          reference_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          issued_by?: string | null
          issued_date?: string
          letter_number: string
          letter_type: string
          member_name: string
          member_number?: string | null
          metadata?: Json | null
          reference_id: string
        }
        Update: {
          created_at?: string
          id?: string
          issued_by?: string | null
          issued_date?: string
          letter_number?: string
          letter_type?: string
          member_name?: string
          member_number?: string | null
          metadata?: Json | null
          reference_id?: string
        }
        Relationships: []
      }
      journal_audit_logs: {
        Row: {
          action: string
          change_summary: string | null
          changed_at: string
          changed_by: string | null
          id: string
          journal_entry_id: string
          new_data: Json | null
          old_data: Json | null
        }
        Insert: {
          action: string
          change_summary?: string | null
          changed_at?: string
          changed_by?: string | null
          id?: string
          journal_entry_id: string
          new_data?: Json | null
          old_data?: Json | null
        }
        Update: {
          action?: string
          change_summary?: string | null
          changed_at?: string
          changed_by?: string | null
          id?: string
          journal_entry_id?: string
          new_data?: Json | null
          old_data?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "journal_audit_logs_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      journal_entries: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          business_unit_id: string | null
          created_at: string
          created_by: string | null
          description: string
          entry_date: string
          entry_number: string
          id: string
          is_balanced: boolean
          reference_id: string | null
          reference_type: string | null
          status: string
          total_credit: number
          total_debit: number
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          business_unit_id?: string | null
          created_at?: string
          created_by?: string | null
          description: string
          entry_date?: string
          entry_number: string
          id?: string
          is_balanced?: boolean
          reference_id?: string | null
          reference_type?: string | null
          status?: string
          total_credit?: number
          total_debit?: number
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          business_unit_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string
          entry_date?: string
          entry_number?: string
          id?: string
          is_balanced?: boolean
          reference_id?: string | null
          reference_type?: string | null
          status?: string
          total_credit?: number
          total_debit?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "journal_entries_business_unit_id_fkey"
            columns: ["business_unit_id"]
            isOneToOne: false
            referencedRelation: "business_units"
            referencedColumns: ["id"]
          },
        ]
      }
      journal_entry_lines: {
        Row: {
          account_id: string
          created_at: string
          credit_amount: number
          debit_amount: number
          description: string | null
          id: string
          journal_entry_id: string
        }
        Insert: {
          account_id: string
          created_at?: string
          credit_amount?: number
          debit_amount?: number
          description?: string | null
          id?: string
          journal_entry_id: string
        }
        Update: {
          account_id?: string
          created_at?: string
          credit_amount?: number
          debit_amount?: number
          description?: string | null
          id?: string
          journal_entry_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "journal_entry_lines_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entry_lines_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      journal_template_audit_logs: {
        Row: {
          action: string
          change_summary: string | null
          changed_by: string | null
          created_at: string | null
          id: string
          new_data: Json | null
          old_data: Json | null
          template_id: string | null
        }
        Insert: {
          action: string
          change_summary?: string | null
          changed_by?: string | null
          created_at?: string | null
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          template_id?: string | null
        }
        Update: {
          action?: string
          change_summary?: string | null
          changed_by?: string | null
          created_at?: string | null
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          template_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "journal_template_audit_logs_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "journal_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      journal_templates: {
        Row: {
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean | null
          lines: Json
          name: string
          type: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          lines?: Json
          name: string
          type: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          lines?: Json
          name?: string
          type?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      letter_sequences: {
        Row: {
          created_at: string
          current_sequence: number
          id: string
          letter_type: string
          month: number | null
          updated_at: string
          year: number
        }
        Insert: {
          created_at?: string
          current_sequence?: number
          id?: string
          letter_type: string
          month?: number | null
          updated_at?: string
          year: number
        }
        Update: {
          created_at?: string
          current_sequence?: number
          id?: string
          letter_type?: string
          month?: number | null
          updated_at?: string
          year?: number
        }
        Relationships: []
      }
      letter_templates: {
        Row: {
          closing_text: string | null
          created_at: string | null
          default_signatory_count: number | null
          element_order: Json | null
          footer_text: string | null
          id: string
          is_active: boolean | null
          letter_type: string
          max_signatories_per_row: number | null
          opening_text: string | null
          selected_signatory_positions: string[] | null
          show_address: boolean | null
          show_auto_print_disclaimer: boolean | null
          show_legal_number: boolean | null
          show_logo: boolean | null
          show_print_date: boolean | null
          show_recipient_signature: boolean | null
          signature_alignment: string | null
          signature_layout: string | null
          signature_position: string | null
          signature_size: string | null
          stamp_position: string | null
          status_badge_color: string | null
          status_badge_text: string | null
          title: string
          updated_at: string | null
          visible_fields: Json | null
        }
        Insert: {
          closing_text?: string | null
          created_at?: string | null
          default_signatory_count?: number | null
          element_order?: Json | null
          footer_text?: string | null
          id?: string
          is_active?: boolean | null
          letter_type: string
          max_signatories_per_row?: number | null
          opening_text?: string | null
          selected_signatory_positions?: string[] | null
          show_address?: boolean | null
          show_auto_print_disclaimer?: boolean | null
          show_legal_number?: boolean | null
          show_logo?: boolean | null
          show_print_date?: boolean | null
          show_recipient_signature?: boolean | null
          signature_alignment?: string | null
          signature_layout?: string | null
          signature_position?: string | null
          signature_size?: string | null
          stamp_position?: string | null
          status_badge_color?: string | null
          status_badge_text?: string | null
          title: string
          updated_at?: string | null
          visible_fields?: Json | null
        }
        Update: {
          closing_text?: string | null
          created_at?: string | null
          default_signatory_count?: number | null
          element_order?: Json | null
          footer_text?: string | null
          id?: string
          is_active?: boolean | null
          letter_type?: string
          max_signatories_per_row?: number | null
          opening_text?: string | null
          selected_signatory_positions?: string[] | null
          show_address?: boolean | null
          show_auto_print_disclaimer?: boolean | null
          show_legal_number?: boolean | null
          show_logo?: boolean | null
          show_print_date?: boolean | null
          show_recipient_signature?: boolean | null
          signature_alignment?: string | null
          signature_layout?: string | null
          signature_position?: string | null
          signature_size?: string | null
          stamp_position?: string | null
          status_badge_color?: string | null
          status_badge_text?: string | null
          title?: string
          updated_at?: string | null
          visible_fields?: Json | null
        }
        Relationships: []
      }
      loan_adjustment_history: {
        Row: {
          adjusted_by: string | null
          adjusted_interest_amount: number
          adjusted_penalty_amount: number
          created_at: string
          id: string
          installment_id: string
          interest_reduction: number
          loan_id: string
          original_interest_amount: number
          original_penalty_amount: number
          penalty_reduction: number
          reason: string
          user_id: string
        }
        Insert: {
          adjusted_by?: string | null
          adjusted_interest_amount: number
          adjusted_penalty_amount?: number
          created_at?: string
          id?: string
          installment_id: string
          interest_reduction?: number
          loan_id: string
          original_interest_amount: number
          original_penalty_amount?: number
          penalty_reduction?: number
          reason: string
          user_id: string
        }
        Update: {
          adjusted_by?: string | null
          adjusted_interest_amount?: number
          adjusted_penalty_amount?: number
          created_at?: string
          id?: string
          installment_id?: string
          interest_reduction?: number
          loan_id?: string
          original_interest_amount?: number
          original_penalty_amount?: number
          penalty_reduction?: number
          reason?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "loan_adjustment_history_installment_id_fkey"
            columns: ["installment_id"]
            isOneToOne: false
            referencedRelation: "loan_installments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loan_adjustment_history_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loans"
            referencedColumns: ["id"]
          },
        ]
      }
      loan_collaterals: {
        Row: {
          collateral_description: string | null
          collateral_type: string
          created_at: string | null
          custodian_admin_id: string | null
          document_number: string | null
          estimated_value: number | null
          id: string
          loan_id: string
          notes: string | null
          received_date: string | null
          returned_date: string | null
          status: string | null
          storage_location: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          collateral_description?: string | null
          collateral_type: string
          created_at?: string | null
          custodian_admin_id?: string | null
          document_number?: string | null
          estimated_value?: number | null
          id?: string
          loan_id: string
          notes?: string | null
          received_date?: string | null
          returned_date?: string | null
          status?: string | null
          storage_location?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          collateral_description?: string | null
          collateral_type?: string
          created_at?: string | null
          custodian_admin_id?: string | null
          document_number?: string | null
          estimated_value?: number | null
          id?: string
          loan_id?: string
          notes?: string | null
          received_date?: string | null
          returned_date?: string | null
          status?: string | null
          storage_location?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "loan_collaterals_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loans"
            referencedColumns: ["id"]
          },
        ]
      }
      loan_installments: {
        Row: {
          adjusted_at: string | null
          adjusted_by: string | null
          adjusted_interest_amount: number | null
          adjusted_penalty_amount: number | null
          adjustment_reason: string | null
          created_at: string | null
          due_date: string
          id: string
          installment_number: number
          interest_amount: number
          loan_id: string
          paid_amount: number | null
          paid_date: string | null
          penalty_amount: number | null
          penalty_months: number | null
          principal_amount: number
          status: Database["public"]["Enums"]["installment_status"] | null
          total_amount: number
          updated_at: string | null
        }
        Insert: {
          adjusted_at?: string | null
          adjusted_by?: string | null
          adjusted_interest_amount?: number | null
          adjusted_penalty_amount?: number | null
          adjustment_reason?: string | null
          created_at?: string | null
          due_date: string
          id?: string
          installment_number: number
          interest_amount: number
          loan_id: string
          paid_amount?: number | null
          paid_date?: string | null
          penalty_amount?: number | null
          penalty_months?: number | null
          principal_amount: number
          status?: Database["public"]["Enums"]["installment_status"] | null
          total_amount: number
          updated_at?: string | null
        }
        Update: {
          adjusted_at?: string | null
          adjusted_by?: string | null
          adjusted_interest_amount?: number | null
          adjusted_penalty_amount?: number | null
          adjustment_reason?: string | null
          created_at?: string | null
          due_date?: string
          id?: string
          installment_number?: number
          interest_amount?: number
          loan_id?: string
          paid_amount?: number | null
          paid_date?: string | null
          penalty_amount?: number | null
          penalty_months?: number | null
          principal_amount?: number
          status?: Database["public"]["Enums"]["installment_status"] | null
          total_amount?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "loan_installments_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loans"
            referencedColumns: ["id"]
          },
        ]
      }
      loans: {
        Row: {
          application_date: string | null
          approved_at: string | null
          approved_by: string | null
          collateral_status: string | null
          created_at: string | null
          disbursement_date: string | null
          id: string
          interest_rate: number | null
          principal_amount: number
          rejection_reason: string | null
          remaining_principal: number | null
          requires_collateral: boolean | null
          status: Database["public"]["Enums"]["loan_status"] | null
          tenor: number
          updated_at: string | null
          user_id: string
        }
        Insert: {
          application_date?: string | null
          approved_at?: string | null
          approved_by?: string | null
          collateral_status?: string | null
          created_at?: string | null
          disbursement_date?: string | null
          id?: string
          interest_rate?: number | null
          principal_amount: number
          rejection_reason?: string | null
          remaining_principal?: number | null
          requires_collateral?: boolean | null
          status?: Database["public"]["Enums"]["loan_status"] | null
          tenor: number
          updated_at?: string | null
          user_id: string
        }
        Update: {
          application_date?: string | null
          approved_at?: string | null
          approved_by?: string | null
          collateral_status?: string | null
          created_at?: string | null
          disbursement_date?: string | null
          id?: string
          interest_rate?: number | null
          principal_amount?: number
          rejection_reason?: string | null
          remaining_principal?: number | null
          requires_collateral?: boolean | null
          status?: Database["public"]["Enums"]["loan_status"] | null
          tenor?: number
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      member_import_logs: {
        Row: {
          created_at: string | null
          failed_count: number | null
          failed_details: Json | null
          file_name: string | null
          id: string
          import_type: string
          performed_by: string | null
          success_count: number | null
          total_rows: number | null
        }
        Insert: {
          created_at?: string | null
          failed_count?: number | null
          failed_details?: Json | null
          file_name?: string | null
          id?: string
          import_type: string
          performed_by?: string | null
          success_count?: number | null
          total_rows?: number | null
        }
        Update: {
          created_at?: string | null
          failed_count?: number | null
          failed_details?: Json | null
          file_name?: string | null
          id?: string
          import_type?: string
          performed_by?: string | null
          success_count?: number | null
          total_rows?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "member_import_logs_performed_by_fkey"
            columns: ["performed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      member_notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          message: string
          metadata: Json | null
          notification_type: string
          read_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          message: string
          metadata?: Json | null
          notification_type: string
          read_at?: string | null
          title: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          metadata?: Json | null
          notification_type?: string
          read_at?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      migration_snapshots: {
        Row: {
          active_loan_count: number
          batch_id: string | null
          coa_piutang_pinjaman: number
          coa_simpanan_pokok: number
          coa_simpanan_sukarela: number
          coa_simpanan_wajib: number
          created_at: string
          created_by: string | null
          id: string
          journal_count: number
          member_count: number
          notes: string | null
          timestamp: string
          total_journal_credit: number
          total_journal_debit: number
          total_loan_principal: number
          total_remaining_principal: number
          total_simpanan: number
          total_simpanan_pokok: number
          total_simpanan_sukarela: number
          total_simpanan_wajib: number
          type: string
        }
        Insert: {
          active_loan_count?: number
          batch_id?: string | null
          coa_piutang_pinjaman?: number
          coa_simpanan_pokok?: number
          coa_simpanan_sukarela?: number
          coa_simpanan_wajib?: number
          created_at?: string
          created_by?: string | null
          id?: string
          journal_count?: number
          member_count?: number
          notes?: string | null
          timestamp?: string
          total_journal_credit?: number
          total_journal_debit?: number
          total_loan_principal?: number
          total_remaining_principal?: number
          total_simpanan?: number
          total_simpanan_pokok?: number
          total_simpanan_sukarela?: number
          total_simpanan_wajib?: number
          type: string
        }
        Update: {
          active_loan_count?: number
          batch_id?: string | null
          coa_piutang_pinjaman?: number
          coa_simpanan_pokok?: number
          coa_simpanan_sukarela?: number
          coa_simpanan_wajib?: number
          created_at?: string
          created_by?: string | null
          id?: string
          journal_count?: number
          member_count?: number
          notes?: string | null
          timestamp?: string
          total_journal_credit?: number
          total_journal_debit?: number
          total_loan_principal?: number
          total_remaining_principal?: number
          total_simpanan?: number
          total_simpanan_pokok?: number
          total_simpanan_sukarela?: number
          total_simpanan_wajib?: number
          type?: string
        }
        Relationships: []
      }
      notification_reads: {
        Row: {
          created_at: string
          id: string
          notification_id: string
          read_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          notification_id: string
          read_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          notification_id?: string
          read_at?: string
          user_id?: string
        }
        Relationships: []
      }
      overdue_handling: {
        Row: {
          contacted_at: string | null
          contacted_by: string | null
          created_at: string
          id: string
          last_updated_by: string | null
          loan_id: string
          notes: string | null
          status: Database["public"]["Enums"]["overdue_handling_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          contacted_at?: string | null
          contacted_by?: string | null
          created_at?: string
          id?: string
          last_updated_by?: string | null
          loan_id: string
          notes?: string | null
          status?: Database["public"]["Enums"]["overdue_handling_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          contacted_at?: string | null
          contacted_by?: string | null
          created_at?: string
          id?: string
          last_updated_by?: string | null
          loan_id?: string
          notes?: string | null
          status?: Database["public"]["Enums"]["overdue_handling_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "overdue_handling_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: true
            referencedRelation: "loans"
            referencedColumns: ["id"]
          },
        ]
      }
      password_change_logs: {
        Row: {
          changed_at: string
          failure_reason: string | null
          id: string
          ip_address: string | null
          status: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          changed_at?: string
          failure_reason?: string | null
          id?: string
          ip_address?: string | null
          status?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          changed_at?: string
          failure_reason?: string | null
          id?: string
          ip_address?: string | null
          status?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      pending_member_data: {
        Row: {
          address: string | null
          bank_account_name: string | null
          bank_account_number: string | null
          birth_date: string | null
          claimed_at: string | null
          claimed_by: string | null
          created_at: string | null
          created_by: string | null
          email: string | null
          gender: string | null
          has_active_loan: boolean | null
          id: string
          import_batch_id: string | null
          join_date: string | null
          loan_data: Json | null
          matched_user_id: string | null
          member_number: string | null
          name: string
          nik: string | null
          phone: string | null
          simpanan_pokok: number | null
          simpanan_sukarela: number | null
          simpanan_wajib: number | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          bank_account_name?: string | null
          bank_account_number?: string | null
          birth_date?: string | null
          claimed_at?: string | null
          claimed_by?: string | null
          created_at?: string | null
          created_by?: string | null
          email?: string | null
          gender?: string | null
          has_active_loan?: boolean | null
          id?: string
          import_batch_id?: string | null
          join_date?: string | null
          loan_data?: Json | null
          matched_user_id?: string | null
          member_number?: string | null
          name: string
          nik?: string | null
          phone?: string | null
          simpanan_pokok?: number | null
          simpanan_sukarela?: number | null
          simpanan_wajib?: number | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          bank_account_name?: string | null
          bank_account_number?: string | null
          birth_date?: string | null
          claimed_at?: string | null
          claimed_by?: string | null
          created_at?: string | null
          created_by?: string | null
          email?: string | null
          gender?: string | null
          has_active_loan?: boolean | null
          id?: string
          import_batch_id?: string | null
          join_date?: string | null
          loan_data?: Json | null
          matched_user_id?: string | null
          member_number?: string | null
          name?: string
          nik?: string | null
          phone?: string | null
          simpanan_pokok?: number | null
          simpanan_sukarela?: number | null
          simpanan_wajib?: number | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pending_member_data_matched_user_id_fkey"
            columns: ["matched_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      profiles: {
        Row: {
          address: string | null
          approval_status: string | null
          bank_account_name: string | null
          bank_account_number: string | null
          bank_name: string | null
          birth_date: string | null
          birth_place: string | null
          branch_id: string | null
          claim_method: string | null
          created_at: string | null
          email: string
          encrypted_nik: string | null
          exit_date: string | null
          exit_year: number | null
          gender: string | null
          id: string
          is_active: boolean | null
          is_migrated_account: boolean | null
          join_date: string | null
          member_number: string | null
          must_change_password: boolean | null
          name: string
          occupation: string | null
          password_changed_at: string | null
          payment_proof_url: string | null
          phone: string | null
          profile_photo: string | null
          rejection_reason: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          address?: string | null
          approval_status?: string | null
          bank_account_name?: string | null
          bank_account_number?: string | null
          bank_name?: string | null
          birth_date?: string | null
          birth_place?: string | null
          branch_id?: string | null
          claim_method?: string | null
          created_at?: string | null
          email: string
          encrypted_nik?: string | null
          exit_date?: string | null
          exit_year?: number | null
          gender?: string | null
          id?: string
          is_active?: boolean | null
          is_migrated_account?: boolean | null
          join_date?: string | null
          member_number?: string | null
          must_change_password?: boolean | null
          name: string
          occupation?: string | null
          password_changed_at?: string | null
          payment_proof_url?: string | null
          phone?: string | null
          profile_photo?: string | null
          rejection_reason?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          address?: string | null
          approval_status?: string | null
          bank_account_name?: string | null
          bank_account_number?: string | null
          bank_name?: string | null
          birth_date?: string | null
          birth_place?: string | null
          branch_id?: string | null
          claim_method?: string | null
          created_at?: string | null
          email?: string
          encrypted_nik?: string | null
          exit_date?: string | null
          exit_year?: number | null
          gender?: string | null
          id?: string
          is_active?: boolean | null
          is_migrated_account?: boolean | null
          join_date?: string | null
          member_number?: string | null
          must_change_password?: boolean | null
          name?: string
          occupation?: string | null
          password_changed_at?: string | null
          payment_proof_url?: string | null
          phone?: string | null
          profile_photo?: string | null
          rejection_reason?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "cooperative_branches"
            referencedColumns: ["id"]
          },
        ]
      }
      reconciliation_logs: {
        Row: {
          action_taken: string | null
          checked_at: string
          checked_by: string | null
          coa_hutang_pokok: number
          coa_hutang_sukarela: number
          coa_hutang_total: number
          coa_hutang_wajib: number
          coa_piutang_pinjaman: number
          created_at: string
          diff_loan_piutang: number
          diff_pokok: number
          diff_savings_total: number
          diff_sukarela: number
          diff_wajib: number
          id: string
          is_reconciled: boolean
          loans_remaining_principal: number
          notes: string | null
          savings_pokok: number
          savings_sukarela: number
          savings_total: number
          savings_wajib: number
        }
        Insert: {
          action_taken?: string | null
          checked_at?: string
          checked_by?: string | null
          coa_hutang_pokok?: number
          coa_hutang_sukarela?: number
          coa_hutang_total?: number
          coa_hutang_wajib?: number
          coa_piutang_pinjaman?: number
          created_at?: string
          diff_loan_piutang?: number
          diff_pokok?: number
          diff_savings_total?: number
          diff_sukarela?: number
          diff_wajib?: number
          id?: string
          is_reconciled?: boolean
          loans_remaining_principal?: number
          notes?: string | null
          savings_pokok?: number
          savings_sukarela?: number
          savings_total?: number
          savings_wajib?: number
        }
        Update: {
          action_taken?: string | null
          checked_at?: string
          checked_by?: string | null
          coa_hutang_pokok?: number
          coa_hutang_sukarela?: number
          coa_hutang_total?: number
          coa_hutang_wajib?: number
          coa_piutang_pinjaman?: number
          created_at?: string
          diff_loan_piutang?: number
          diff_pokok?: number
          diff_savings_total?: number
          diff_sukarela?: number
          diff_wajib?: number
          id?: string
          is_reconciled?: boolean
          loans_remaining_principal?: number
          notes?: string | null
          savings_pokok?: number
          savings_sukarela?: number
          savings_total?: number
          savings_wajib?: number
        }
        Relationships: []
      }
      resignation_requests: {
        Row: {
          created_at: string
          id: string
          journal_entry_id: string | null
          processed_at: string | null
          processed_by: string | null
          reason: string
          refund_amount: number
          rejection_reason: string | null
          remaining_loan_principal: number
          simpanan_pokok: number
          simpanan_sukarela: number
          simpanan_wajib: number
          status: string
          total_arrears: number
          total_penalties: number
          total_savings: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          journal_entry_id?: string | null
          processed_at?: string | null
          processed_by?: string | null
          reason: string
          refund_amount?: number
          rejection_reason?: string | null
          remaining_loan_principal?: number
          simpanan_pokok?: number
          simpanan_sukarela?: number
          simpanan_wajib?: number
          status?: string
          total_arrears?: number
          total_penalties?: number
          total_savings?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          journal_entry_id?: string | null
          processed_at?: string | null
          processed_by?: string | null
          reason?: string
          refund_amount?: number
          rejection_reason?: string | null
          remaining_loan_principal?: number
          simpanan_pokok?: number
          simpanan_sukarela?: number
          simpanan_wajib?: number
          status?: string
          total_arrears?: number
          total_penalties?: number
          total_savings?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      role_assignments: {
        Row: {
          business_unit_id: string | null
          created_at: string
          id: string
          is_member: boolean
          member_id: string | null
          name: string
          position: string | null
          role: string
          share_percentage: number
          updated_at: string
        }
        Insert: {
          business_unit_id?: string | null
          created_at?: string
          id?: string
          is_member?: boolean
          member_id?: string | null
          name: string
          position?: string | null
          role: string
          share_percentage?: number
          updated_at?: string
        }
        Update: {
          business_unit_id?: string | null
          created_at?: string
          id?: string
          is_member?: boolean
          member_id?: string | null
          name?: string
          position?: string | null
          role?: string
          share_percentage?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_assignments_business_unit_id_fkey"
            columns: ["business_unit_id"]
            isOneToOne: false
            referencedRelation: "business_units"
            referencedColumns: ["id"]
          },
        ]
      }
      savings_audit_log: {
        Row: {
          change_type: string
          changed_at: string
          changed_by: string | null
          id: string
          new_simpanan_pokok: number | null
          new_simpanan_sukarela: number | null
          new_simpanan_wajib: number | null
          new_total_simpanan: number | null
          notes: string | null
          old_simpanan_pokok: number | null
          old_simpanan_sukarela: number | null
          old_simpanan_wajib: number | null
          old_total_simpanan: number | null
          source: string | null
          user_id: string
        }
        Insert: {
          change_type: string
          changed_at?: string
          changed_by?: string | null
          id?: string
          new_simpanan_pokok?: number | null
          new_simpanan_sukarela?: number | null
          new_simpanan_wajib?: number | null
          new_total_simpanan?: number | null
          notes?: string | null
          old_simpanan_pokok?: number | null
          old_simpanan_sukarela?: number | null
          old_simpanan_wajib?: number | null
          old_total_simpanan?: number | null
          source?: string | null
          user_id: string
        }
        Update: {
          change_type?: string
          changed_at?: string
          changed_by?: string | null
          id?: string
          new_simpanan_pokok?: number | null
          new_simpanan_sukarela?: number | null
          new_simpanan_wajib?: number | null
          new_total_simpanan?: number | null
          notes?: string | null
          old_simpanan_pokok?: number | null
          old_simpanan_sukarela?: number | null
          old_simpanan_wajib?: number | null
          old_total_simpanan?: number | null
          source?: string | null
          user_id?: string
        }
        Relationships: []
      }
      savings_summary: {
        Row: {
          id: string
          simpanan_pokok: number | null
          simpanan_sukarela: number | null
          simpanan_wajib: number | null
          total_simpanan: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          id?: string
          simpanan_pokok?: number | null
          simpanan_sukarela?: number | null
          simpanan_wajib?: number | null
          total_simpanan?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          id?: string
          simpanan_pokok?: number | null
          simpanan_sukarela?: number | null
          simpanan_wajib?: number | null
          total_simpanan?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      settings_change_logs: {
        Row: {
          application_mode: string
          change_reason: string | null
          changed_by: string | null
          created_at: string
          effective_from: string
          id: string
          new_value: Json
          old_value: Json | null
          setting_key: string
        }
        Insert: {
          application_mode?: string
          change_reason?: string | null
          changed_by?: string | null
          created_at?: string
          effective_from?: string
          id?: string
          new_value: Json
          old_value?: Json | null
          setting_key: string
        }
        Update: {
          application_mode?: string
          change_reason?: string | null
          changed_by?: string | null
          created_at?: string
          effective_from?: string
          id?: string
          new_value?: Json
          old_value?: Json | null
          setting_key?: string
        }
        Relationships: []
      }
      shu_distributions: {
        Row: {
          confirmed_at: string | null
          created_at: string
          dana_cadangan: number
          dana_pembangunan: number
          dana_pendidikan: number
          dana_sosial: number
          id: string
          member_distributions: Json
          role_distributions: Json
          shu_anggota_jasa_pinjaman: number
          shu_anggota_simpanan: number
          shu_anggota_total: number
          shu_bruto: number
          shu_penasihat: number
          shu_pengawas: number
          shu_pengurus: number
          status: string
          updated_at: string
          year: number
        }
        Insert: {
          confirmed_at?: string | null
          created_at?: string
          dana_cadangan?: number
          dana_pembangunan?: number
          dana_pendidikan?: number
          dana_sosial?: number
          id?: string
          member_distributions?: Json
          role_distributions?: Json
          shu_anggota_jasa_pinjaman?: number
          shu_anggota_simpanan?: number
          shu_anggota_total?: number
          shu_bruto?: number
          shu_penasihat?: number
          shu_pengawas?: number
          shu_pengurus?: number
          status?: string
          updated_at?: string
          year: number
        }
        Update: {
          confirmed_at?: string | null
          created_at?: string
          dana_cadangan?: number
          dana_pembangunan?: number
          dana_pendidikan?: number
          dana_sosial?: number
          id?: string
          member_distributions?: Json
          role_distributions?: Json
          shu_anggota_jasa_pinjaman?: number
          shu_anggota_simpanan?: number
          shu_anggota_total?: number
          shu_bruto?: number
          shu_penasihat?: number
          shu_pengawas?: number
          shu_pengurus?: number
          status?: string
          updated_at?: string
          year?: number
        }
        Relationships: []
      }
      shu_fund_activities: {
        Row: {
          activity_date: string
          amount: number
          created_at: string
          created_by: string | null
          description: string | null
          fund_type: string
          id: string
          status: string
          title: string
          updated_at: string
          year: number
        }
        Insert: {
          activity_date?: string
          amount?: number
          created_at?: string
          created_by?: string | null
          description?: string | null
          fund_type: string
          id?: string
          status?: string
          title: string
          updated_at?: string
          year?: number
        }
        Update: {
          activity_date?: string
          amount?: number
          created_at?: string
          created_by?: string | null
          description?: string | null
          fund_type?: string
          id?: string
          status?: string
          title?: string
          updated_at?: string
          year?: number
        }
        Relationships: []
      }
      shu_records: {
        Row: {
          amount: number
          created_at: string | null
          distributed_at: string | null
          id: string
          notes: string | null
          user_id: string
          year: number
        }
        Insert: {
          amount: number
          created_at?: string | null
          distributed_at?: string | null
          id?: string
          notes?: string | null
          user_id: string
          year: number
        }
        Update: {
          amount?: number
          created_at?: string | null
          distributed_at?: string | null
          id?: string
          notes?: string | null
          user_id?: string
          year?: number
        }
        Relationships: []
      }
      shu_rollover_history: {
        Row: {
          created_at: string
          created_by: string | null
          dana_cadangan_rollover: number
          dana_pembangunan_rollover: number
          dana_pendidikan_rollover: number
          dana_sosial_rollover: number
          from_year: number
          id: string
          journal_entry_id: string | null
          notes: string | null
          shu_withheld_rollover: number
          status: string
          to_year: number
          total_rollover_amount: number
          withheld_members_count: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          dana_cadangan_rollover?: number
          dana_pembangunan_rollover?: number
          dana_pendidikan_rollover?: number
          dana_sosial_rollover?: number
          from_year: number
          id?: string
          journal_entry_id?: string | null
          notes?: string | null
          shu_withheld_rollover?: number
          status?: string
          to_year: number
          total_rollover_amount?: number
          withheld_members_count?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          dana_cadangan_rollover?: number
          dana_pembangunan_rollover?: number
          dana_pendidikan_rollover?: number
          dana_sosial_rollover?: number
          from_year?: number
          id?: string
          journal_entry_id?: string | null
          notes?: string | null
          shu_withheld_rollover?: number
          status?: string
          to_year?: number
          total_rollover_amount?: number
          withheld_members_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "shu_rollover_history_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      shu_withheld: {
        Row: {
          active_months: number | null
          arrears_amount: number
          calculation_method: string | null
          created_at: string
          exclusion_note: string | null
          exit_date: string | null
          id: string
          is_exited_member: boolean | null
          jasa_usaha_share: number
          manual_exclusion: boolean
          paid_amount: number | null
          paid_at: string | null
          payment_status: string | null
          released_amount: number | null
          released_at: string | null
          released_by: string | null
          shu_amount: number
          simpanan_share: number
          status: string
          updated_at: string
          used_for_arrears: number | null
          user_id: string
          withhold_reason: string
          year: number
        }
        Insert: {
          active_months?: number | null
          arrears_amount?: number
          calculation_method?: string | null
          created_at?: string
          exclusion_note?: string | null
          exit_date?: string | null
          id?: string
          is_exited_member?: boolean | null
          jasa_usaha_share?: number
          manual_exclusion?: boolean
          paid_amount?: number | null
          paid_at?: string | null
          payment_status?: string | null
          released_amount?: number | null
          released_at?: string | null
          released_by?: string | null
          shu_amount?: number
          simpanan_share?: number
          status?: string
          updated_at?: string
          used_for_arrears?: number | null
          user_id: string
          withhold_reason?: string
          year: number
        }
        Update: {
          active_months?: number | null
          arrears_amount?: number
          calculation_method?: string | null
          created_at?: string
          exclusion_note?: string | null
          exit_date?: string | null
          id?: string
          is_exited_member?: boolean | null
          jasa_usaha_share?: number
          manual_exclusion?: boolean
          paid_amount?: number | null
          paid_at?: string | null
          payment_status?: string | null
          released_amount?: number | null
          released_at?: string | null
          released_by?: string | null
          shu_amount?: number
          simpanan_share?: number
          status?: string
          updated_at?: string
          used_for_arrears?: number | null
          user_id?: string
          withhold_reason?: string
          year?: number
        }
        Relationships: []
      }
      signatory_signatures: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          role_assignment_id: string
          signature_base64: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          role_assignment_id: string
          signature_base64?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          role_assignment_id?: string
          signature_base64?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "signatory_signatures_role_assignment_id_fkey"
            columns: ["role_assignment_id"]
            isOneToOne: true
            referencedRelation: "role_assignments"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          account_holder_name: string | null
          adjusted_at: string | null
          adjusted_by: string | null
          adjustment_reason: string | null
          amount: number
          approved_at: string | null
          approved_by: string | null
          created_at: string | null
          date: string | null
          id: string
          installment_id: string | null
          is_migration: boolean | null
          journal_entry_id: string | null
          notes: string | null
          original_amount: number | null
          original_date: string | null
          payment_method: Database["public"]["Enums"]["payment_method"]
          rejection_reason: string | null
          status: Database["public"]["Enums"]["transaction_status"] | null
          type: Database["public"]["Enums"]["transaction_type"]
          user_id: string
        }
        Insert: {
          account_holder_name?: string | null
          adjusted_at?: string | null
          adjusted_by?: string | null
          adjustment_reason?: string | null
          amount: number
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string | null
          date?: string | null
          id?: string
          installment_id?: string | null
          is_migration?: boolean | null
          journal_entry_id?: string | null
          notes?: string | null
          original_amount?: number | null
          original_date?: string | null
          payment_method: Database["public"]["Enums"]["payment_method"]
          rejection_reason?: string | null
          status?: Database["public"]["Enums"]["transaction_status"] | null
          type: Database["public"]["Enums"]["transaction_type"]
          user_id: string
        }
        Update: {
          account_holder_name?: string | null
          adjusted_at?: string | null
          adjusted_by?: string | null
          adjustment_reason?: string | null
          amount?: number
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string | null
          date?: string | null
          id?: string
          installment_id?: string | null
          is_migration?: boolean | null
          journal_entry_id?: string | null
          notes?: string | null
          original_amount?: number | null
          original_date?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"]
          rejection_reason?: string | null
          status?: Database["public"]["Enums"]["transaction_status"] | null
          type?: Database["public"]["Enums"]["transaction_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_installment_id_fkey"
            columns: ["installment_id"]
            isOneToOne: false
            referencedRelation: "loan_installments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string | null
          granted_at: string | null
          granted_by: string | null
          id: string
          role: Database["public"]["Enums"]["user_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          granted_at?: string | null
          granted_by?: string | null
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          granted_at?: string | null
          granted_by?: string | null
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      apply_admin_role_template: {
        Args: { p_role: string; p_updated_by?: string; p_user_id: string }
        Returns: boolean
      }
      check_nik_exists: { Args: { p_nik: string }; Returns: boolean }
      cleanup_expired_claim_tokens: { Args: never; Returns: number }
      decrypt_nik: { Args: { encrypted_nik: string }; Returns: string }
      encrypt_nik: { Args: { plain_nik: string }; Returns: string }
      find_user_by_nik: { Args: { p_nik: string }; Returns: string }
      generate_journal_entry_number: { Args: never; Returns: string }
      generate_member_number: { Args: never; Returns: string }
      get_admin_role_template: { Args: { p_role: string }; Returns: Json }
      get_all_profiles_with_nik: {
        Args: never
        Returns: {
          address: string
          approval_status: string
          bank_account_name: string
          bank_account_number: string
          bank_name: string
          birth_date: string
          birth_place: string
          branch_id: string
          email: string
          exit_date: string
          exit_reason: string
          gender: string
          is_active: boolean
          join_date: string
          member_number: string
          name: string
          nik: string
          occupation: string
          phone: string
          user_id: string
        }[]
      }
      get_decrypted_nik: { Args: { p_user_id: string }; Returns: string }
      get_next_letter_number: {
        Args: { p_letter_type: string; p_reset_period?: string }
        Returns: string
      }
      get_next_member_number: {
        Args: { p_date: string; p_prefix: string }
        Returns: string
      }
      get_profile_with_nik: {
        Args: { p_user_id: string }
        Returns: {
          address: string
          approval_status: string
          bank_account_name: string
          bank_account_number: string
          bank_name: string
          birth_date: string
          birth_place: string
          branch_id: string
          email: string
          gender: string
          is_active: boolean
          join_date: string
          member_number: string
          name: string
          nik: string
          occupation: string
          phone: string
          profile_photo: string
          user_id: string
        }[]
      }
      has_admin_permission: {
        Args: { _permission: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["user_role"]
          _user_id: string
        }
        Returns: boolean
      }
      initialize_journal_templates: { Args: never; Returns: undefined }
      insert_profile_with_nik: {
        Args: {
          p_address?: string
          p_approval_status?: string
          p_bank_account_name?: string
          p_bank_account_number?: string
          p_bank_name?: string
          p_birth_date?: string
          p_birth_place?: string
          p_branch_id?: string
          p_email: string
          p_gender?: string
          p_is_active?: boolean
          p_is_migration?: boolean
          p_join_date?: string
          p_member_number?: string
          p_name: string
          p_nik?: string
          p_occupation?: string
          p_phone?: string
          p_user_id: string
        }
        Returns: string
      }
      is_admin: { Args: never; Returns: boolean }
      is_service_role: { Args: never; Returns: boolean }
      perform_reconciliation_check: {
        Args: { p_user_id?: string }
        Returns: {
          coa_piutang: number
          coa_total: number
          diff_loans: number
          diff_savings: number
          is_reconciled: boolean
          loan_remaining: number
          savings_total: number
        }[]
      }
      sync_coa_from_savings: { Args: { p_user_id?: string }; Returns: boolean }
      update_member_nik: {
        Args: { p_nik: string; p_user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      account_type: "asset" | "liability" | "equity" | "income" | "expense"
      installment_status: "pending" | "paid" | "overdue" | "partial" | "unpaid"
      loan_status: "pending" | "active" | "completed" | "defaulted" | "rejected"
      overdue_handling_status:
        | "pending"
        | "contacted"
        | "in_progress"
        | "resolved"
        | "escalated"
      payment_method: "transfer_bank" | "e_wallet"
      transaction_status: "pending" | "approved" | "rejected"
      transaction_type:
        | "simpanan_pokok"
        | "simpanan_wajib"
        | "simpanan_sukarela"
        | "setor_simpanan_wajib"
        | "setor_simpanan_sukarela"
        | "penarikan_simpanan_sukarela"
        | "bayar_angsuran_pinjaman"
        | "saldo_awal_pokok"
        | "saldo_awal_wajib"
        | "saldo_awal_sukarela"
        | "saldo_awal_pinjaman"
        | "pencairan_pinjaman"
      user_role: "member" | "admin"
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
  public: {
    Enums: {
      account_type: ["asset", "liability", "equity", "income", "expense"],
      installment_status: ["pending", "paid", "overdue", "partial", "unpaid"],
      loan_status: ["pending", "active", "completed", "defaulted", "rejected"],
      overdue_handling_status: [
        "pending",
        "contacted",
        "in_progress",
        "resolved",
        "escalated",
      ],
      payment_method: ["transfer_bank", "e_wallet"],
      transaction_status: ["pending", "approved", "rejected"],
      transaction_type: [
        "simpanan_pokok",
        "simpanan_wajib",
        "simpanan_sukarela",
        "setor_simpanan_wajib",
        "setor_simpanan_sukarela",
        "penarikan_simpanan_sukarela",
        "bayar_angsuran_pinjaman",
        "saldo_awal_pokok",
        "saldo_awal_wajib",
        "saldo_awal_sukarela",
        "saldo_awal_pinjaman",
        "pencairan_pinjaman",
      ],
      user_role: ["member", "admin"],
    },
  },
} as const
