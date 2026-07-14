/**
 * Tipos do banco GERADOS a partir do projeto Supabase do Hexx Hub Digital
 * (ref dgixajsmecysehwytlav). NÃO editar à mão.
 *
 * Regerar após mudanças de schema:
 *   npx supabase gen types typescript --project-id dgixajsmecysehwytlav > src/types/database.types.ts
 * (ou via MCP generate_typescript_types)
 */

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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      accounting_invoice: {
        Row: {
          company_id: string
          description: string
          due_date: string
          id: string
          pix_code: string | null
          reference_month: string
          status: Database["public"]["Enums"]["doc_status"]
          value: number
        }
        Insert: {
          company_id: string
          description: string
          due_date: string
          id?: string
          pix_code?: string | null
          reference_month: string
          status?: Database["public"]["Enums"]["doc_status"]
          value: number
        }
        Update: {
          company_id?: string
          description?: string
          due_date?: string
          id?: string
          pix_code?: string | null
          reference_month?: string
          status?: Database["public"]["Enums"]["doc_status"]
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "accounting_invoice_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
        ]
      }
      app_user: {
        Row: {
          auth_uid: string
          created_at: string
          email: string
          id: string
          name: string
        }
        Insert: {
          auth_uid: string
          created_at?: string
          email: string
          id?: string
          name: string
        }
        Update: {
          auth_uid?: string
          created_at?: string
          email?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      bank_account: {
        Row: {
          bank_name: string
          company_id: string
          created_at: string
          current_balance: number
          id: string
          number: string | null
          open_finance_item_id: string | null
        }
        Insert: {
          bank_name: string
          company_id: string
          created_at?: string
          current_balance?: number
          id?: string
          number?: string | null
          open_finance_item_id?: string | null
        }
        Update: {
          bank_name?: string
          company_id?: string
          created_at?: string
          current_balance?: number
          id?: string
          number?: string | null
          open_finance_item_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bank_account_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_transaction: {
        Row: {
          amount: number
          bank_account_id: string
          company_id: string
          description: string
          external_id: string | null
          id: string
          posted_at: string
          reconciliation_status: Database["public"]["Enums"]["reconciliation_status"]
        }
        Insert: {
          amount: number
          bank_account_id: string
          company_id: string
          description: string
          external_id?: string | null
          id?: string
          posted_at: string
          reconciliation_status?: Database["public"]["Enums"]["reconciliation_status"]
        }
        Update: {
          amount?: number
          bank_account_id?: string
          company_id?: string
          description?: string
          external_id?: string | null
          id?: string
          posted_at?: string
          reconciliation_status?: Database["public"]["Enums"]["reconciliation_status"]
        }
        Relationships: [
          {
            foreignKeyName: "bank_transaction_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_account"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_transaction_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
        ]
      }
      category: {
        Row: {
          company_id: string
          id: string
          kind: Database["public"]["Enums"]["category_kind"]
          name: string
        }
        Insert: {
          company_id: string
          id?: string
          kind: Database["public"]["Enums"]["category_kind"]
          name: string
        }
        Update: {
          company_id?: string
          id?: string
          kind?: Database["public"]["Enums"]["category_kind"]
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "category_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
        ]
      }
      company: {
        Row: {
          cnpj: string
          created_at: string
          id: string
          legal_name: string
          revenue_ceiling: number | null
          tax_regime: Database["public"]["Enums"]["tax_regime"]
          trade_name: string | null
          type: Database["public"]["Enums"]["company_type"]
        }
        Insert: {
          cnpj: string
          created_at?: string
          id?: string
          legal_name: string
          revenue_ceiling?: number | null
          tax_regime?: Database["public"]["Enums"]["tax_regime"]
          trade_name?: string | null
          type: Database["public"]["Enums"]["company_type"]
        }
        Update: {
          cnpj?: string
          created_at?: string
          id?: string
          legal_name?: string
          revenue_ceiling?: number | null
          tax_regime?: Database["public"]["Enums"]["tax_regime"]
          trade_name?: string | null
          type?: Database["public"]["Enums"]["company_type"]
        }
        Relationships: []
      }
      contract: {
        Row: {
          billing_cycle: Database["public"]["Enums"]["billing_cycle"]
          company_id: string
          created_at: string
          customer_id: string
          id: string
          next_billing_date: string | null
          status: Database["public"]["Enums"]["contract_status"]
          title: string
          value: number
        }
        Insert: {
          billing_cycle?: Database["public"]["Enums"]["billing_cycle"]
          company_id: string
          created_at?: string
          customer_id: string
          id?: string
          next_billing_date?: string | null
          status?: Database["public"]["Enums"]["contract_status"]
          title: string
          value: number
        }
        Update: {
          billing_cycle?: Database["public"]["Enums"]["billing_cycle"]
          company_id?: string
          created_at?: string
          customer_id?: string
          id?: string
          next_billing_date?: string | null
          status?: Database["public"]["Enums"]["contract_status"]
          title?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "contract_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer"
            referencedColumns: ["id"]
          },
        ]
      }
      customer: {
        Row: {
          company_id: string
          created_at: string
          document: string | null
          email: string | null
          id: string
          name: string
        }
        Insert: {
          company_id: string
          created_at?: string
          document?: string | null
          email?: string | null
          id?: string
          name: string
        }
        Update: {
          company_id?: string
          created_at?: string
          document?: string | null
          email?: string | null
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
        ]
      }
      employee: {
        Row: {
          admission_date: string | null
          company_id: string
          cpf: string | null
          id: string
          name: string
          role_title: string | null
          salary: number | null
          status: Database["public"]["Enums"]["employee_status"]
        }
        Insert: {
          admission_date?: string | null
          company_id: string
          cpf?: string | null
          id?: string
          name: string
          role_title?: string | null
          salary?: number | null
          status?: Database["public"]["Enums"]["employee_status"]
        }
        Update: {
          admission_date?: string | null
          company_id?: string
          cpf?: string | null
          id?: string
          name?: string
          role_title?: string | null
          salary?: number | null
          status?: Database["public"]["Enums"]["employee_status"]
        }
        Relationships: [
          {
            foreignKeyName: "employee_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
        ]
      }
      employment_event: {
        Row: {
          employee_id: string
          event_date: string
          form_data: Json | null
          id: string
          type: Database["public"]["Enums"]["employment_event_type"]
        }
        Insert: {
          employee_id: string
          event_date: string
          form_data?: Json | null
          id?: string
          type: Database["public"]["Enums"]["employment_event_type"]
        }
        Update: {
          employee_id?: string
          event_date?: string
          form_data?: Json | null
          id?: string
          type?: Database["public"]["Enums"]["employment_event_type"]
        }
        Relationships: [
          {
            foreignKeyName: "employment_event_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_entry: {
        Row: {
          amount: number
          bank_account_id: string | null
          category_id: string | null
          company_id: string
          created_at: string
          description: string
          due_date: string
          id: string
          reference_month: string
          source: string
          source_id: string | null
          status: Database["public"]["Enums"]["entry_status"]
          type: Database["public"]["Enums"]["entry_type"]
        }
        Insert: {
          amount: number
          bank_account_id?: string | null
          category_id?: string | null
          company_id: string
          created_at?: string
          description: string
          due_date: string
          id?: string
          reference_month: string
          source?: string
          source_id?: string | null
          status?: Database["public"]["Enums"]["entry_status"]
          type: Database["public"]["Enums"]["entry_type"]
        }
        Update: {
          amount?: number
          bank_account_id?: string | null
          category_id?: string | null
          company_id?: string
          created_at?: string
          description?: string
          due_date?: string
          id?: string
          reference_month?: string
          source?: string
          source_id?: string | null
          status?: Database["public"]["Enums"]["entry_status"]
          type?: Database["public"]["Enums"]["entry_type"]
        }
        Relationships: [
          {
            foreignKeyName: "financial_entry_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_account"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_entry_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "category"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_entry_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_credential: {
        Row: {
          active: boolean
          company_id: string
          id: string
          kind: Database["public"]["Enums"]["integration_kind"]
          provider: string
          secret_ref: Json | null
        }
        Insert: {
          active?: boolean
          company_id: string
          id?: string
          kind: Database["public"]["Enums"]["integration_kind"]
          provider: string
          secret_ref?: Json | null
        }
        Update: {
          active?: boolean
          company_id?: string
          id?: string
          kind?: Database["public"]["Enums"]["integration_kind"]
          provider?: string
          secret_ref?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "integration_credential_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
        ]
      }
      lease: {
        Row: {
          adjustment_anchor: string
          company_id: string
          end_date: string | null
          id: string
          index_type: Database["public"]["Enums"]["index_type"]
          lessee_name: string
          monthly_rent: number
          property_id: string
          start_date: string | null
          status: Database["public"]["Enums"]["lease_status"]
        }
        Insert: {
          adjustment_anchor: string
          company_id: string
          end_date?: string | null
          id?: string
          index_type?: Database["public"]["Enums"]["index_type"]
          lessee_name: string
          monthly_rent: number
          property_id: string
          start_date?: string | null
          status?: Database["public"]["Enums"]["lease_status"]
        }
        Update: {
          adjustment_anchor?: string
          company_id?: string
          end_date?: string | null
          id?: string
          index_type?: Database["public"]["Enums"]["index_type"]
          lessee_name?: string
          monthly_rent?: number
          property_id?: string
          start_date?: string | null
          status?: Database["public"]["Enums"]["lease_status"]
        }
        Relationships: [
          {
            foreignKeyName: "lease_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lease_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "property"
            referencedColumns: ["id"]
          },
        ]
      }
      membership: {
        Row: {
          company_id: string
          created_at: string
          id: string
          role: Database["public"]["Enums"]["user_role"]
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "membership_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "membership_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "app_user"
            referencedColumns: ["id"]
          },
        ]
      }
      notification: {
        Row: {
          body: string | null
          company_id: string
          created_at: string
          id: string
          read: boolean
          severity: Database["public"]["Enums"]["notification_severity"]
          title: string
        }
        Insert: {
          body?: string | null
          company_id: string
          created_at?: string
          id?: string
          read?: boolean
          severity?: Database["public"]["Enums"]["notification_severity"]
          title: string
        }
        Update: {
          body?: string | null
          company_id?: string
          created_at?: string
          id?: string
          read?: boolean
          severity?: Database["public"]["Enums"]["notification_severity"]
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
        ]
      }
      partner: {
        Row: {
          company_id: string
          id: string
          name: string
          ownership_pct: number
        }
        Insert: {
          company_id: string
          id?: string
          name: string
          ownership_pct: number
        }
        Update: {
          company_id?: string
          id?: string
          name?: string
          ownership_pct?: number
        }
        Relationships: [
          {
            foreignKeyName: "partner_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_distribution: {
        Row: {
          gross_profit: number
          id: string
          net_distributed: number
          partner_id: string
          reference_month: string
          taxes: number
        }
        Insert: {
          gross_profit: number
          id?: string
          net_distributed: number
          partner_id: string
          reference_month: string
          taxes: number
        }
        Update: {
          gross_profit?: number
          id?: string
          net_distributed?: number
          partner_id?: string
          reference_month?: string
          taxes?: number
        }
        Relationships: [
          {
            foreignKeyName: "partner_distribution_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partner"
            referencedColumns: ["id"]
          },
        ]
      }
      payslip: {
        Row: {
          employee_id: string
          file_url: string | null
          id: string
          net_amount: number
          reference_month: string
        }
        Insert: {
          employee_id: string
          file_url?: string | null
          id?: string
          net_amount: number
          reference_month: string
        }
        Update: {
          employee_id?: string
          file_url?: string | null
          id?: string
          net_amount?: number
          reference_month?: string
        }
        Relationships: [
          {
            foreignKeyName: "payslip_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee"
            referencedColumns: ["id"]
          },
        ]
      }
      plan: {
        Row: {
          features: Json | null
          id: string
          monthly_value: number
          name: string
        }
        Insert: {
          features?: Json | null
          id?: string
          monthly_value: number
          name: string
        }
        Update: {
          features?: Json | null
          id?: string
          monthly_value?: number
          name?: string
        }
        Relationships: []
      }
      property: {
        Row: {
          acquisition_value: number | null
          address: string | null
          company_id: string
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["property_kind"]
          label: string
          status: Database["public"]["Enums"]["property_status"]
        }
        Insert: {
          acquisition_value?: number | null
          address?: string | null
          company_id: string
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["property_kind"]
          label: string
          status?: Database["public"]["Enums"]["property_status"]
        }
        Update: {
          acquisition_value?: number | null
          address?: string | null
          company_id?: string
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["property_kind"]
          label?: string
          status?: Database["public"]["Enums"]["property_status"]
        }
        Relationships: [
          {
            foreignKeyName: "property_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
        ]
      }
      reconciliation_match: {
        Row: {
          bank_transaction_id: string
          company_id: string
          financial_entry_id: string
          id: string
          matched_at: string
        }
        Insert: {
          bank_transaction_id: string
          company_id: string
          financial_entry_id: string
          id?: string
          matched_at?: string
        }
        Update: {
          bank_transaction_id?: string
          company_id?: string
          financial_entry_id?: string
          id?: string
          matched_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reconciliation_match_bank_transaction_id_fkey"
            columns: ["bank_transaction_id"]
            isOneToOne: false
            referencedRelation: "bank_transaction"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reconciliation_match_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reconciliation_match_financial_entry_id_fkey"
            columns: ["financial_entry_id"]
            isOneToOne: false
            referencedRelation: "financial_entry"
            referencedColumns: ["id"]
          },
        ]
      }
      rent_invoice: {
        Row: {
          amount: number
          boleto_url: string | null
          company_id: string
          id: string
          lease_id: string
          receipt_url: string | null
          reference_month: string
          status: Database["public"]["Enums"]["rent_invoice_status"]
        }
        Insert: {
          amount: number
          boleto_url?: string | null
          company_id: string
          id?: string
          lease_id: string
          receipt_url?: string | null
          reference_month: string
          status?: Database["public"]["Enums"]["rent_invoice_status"]
        }
        Update: {
          amount?: number
          boleto_url?: string | null
          company_id?: string
          id?: string
          lease_id?: string
          receipt_url?: string | null
          reference_month?: string
          status?: Database["public"]["Enums"]["rent_invoice_status"]
        }
        Relationships: [
          {
            foreignKeyName: "rent_invoice_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rent_invoice_lease_id_fkey"
            columns: ["lease_id"]
            isOneToOne: false
            referencedRelation: "lease"
            referencedColumns: ["id"]
          },
        ]
      }
      service_invoice: {
        Row: {
          amount: number
          company_id: string
          contract_id: string | null
          created_at: string
          customer_id: string | null
          id: string
          nfse_number: string | null
          pdf_url: string | null
          provider_protocol: string | null
          reference_month: string
          service_description: string
          status: Database["public"]["Enums"]["invoice_status"]
        }
        Insert: {
          amount: number
          company_id: string
          contract_id?: string | null
          created_at?: string
          customer_id?: string | null
          id?: string
          nfse_number?: string | null
          pdf_url?: string | null
          provider_protocol?: string | null
          reference_month: string
          service_description: string
          status?: Database["public"]["Enums"]["invoice_status"]
        }
        Update: {
          amount?: number
          company_id?: string
          contract_id?: string | null
          created_at?: string
          customer_id?: string | null
          id?: string
          nfse_number?: string | null
          pdf_url?: string | null
          provider_protocol?: string | null
          reference_month?: string
          service_description?: string
          status?: Database["public"]["Enums"]["invoice_status"]
        }
        Relationships: [
          {
            foreignKeyName: "service_invoice_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_invoice_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contract"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_invoice_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer"
            referencedColumns: ["id"]
          },
        ]
      }
      signature_request: {
        Row: {
          company_id: string
          created_at: string
          id: string
          provider_envelope_id: string | null
          status: Database["public"]["Enums"]["signature_status"]
          subject_id: string
          subject_type: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          provider_envelope_id?: string | null
          status?: Database["public"]["Enums"]["signature_status"]
          subject_id: string
          subject_type: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          provider_envelope_id?: string | null
          status?: Database["public"]["Enums"]["signature_status"]
          subject_id?: string
          subject_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "signature_request_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription: {
        Row: {
          company_id: string
          current_period_end: string | null
          current_period_start: string | null
          id: string
          plan_id: string
          status: Database["public"]["Enums"]["subscription_status"]
        }
        Insert: {
          company_id: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          plan_id: string
          status?: Database["public"]["Enums"]["subscription_status"]
        }
        Update: {
          company_id?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          plan_id?: string
          status?: Database["public"]["Enums"]["subscription_status"]
        }
        Relationships: [
          {
            foreignKeyName: "subscription_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plan"
            referencedColumns: ["id"]
          },
        ]
      }
      tax_guide: {
        Row: {
          amount: number
          company_id: string
          due_date: string
          file_url: string | null
          id: string
          pix_code: string | null
          reference_month: string
          status: Database["public"]["Enums"]["doc_status"]
          tax_name: string
        }
        Insert: {
          amount: number
          company_id: string
          due_date: string
          file_url?: string | null
          id?: string
          pix_code?: string | null
          reference_month: string
          status?: Database["public"]["Enums"]["doc_status"]
          tax_name: string
        }
        Update: {
          amount?: number
          company_id?: string
          due_date?: string
          file_url?: string | null
          id?: string
          pix_code?: string | null
          reference_month?: string
          status?: Database["public"]["Enums"]["doc_status"]
          tax_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "tax_guide_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket: {
        Row: {
          company_id: string
          created_at: string
          id: string
          priority: Database["public"]["Enums"]["ticket_priority"]
          status: Database["public"]["Enums"]["ticket_status"]
          subject: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          priority?: Database["public"]["Enums"]["ticket_priority"]
          status?: Database["public"]["Enums"]["ticket_status"]
          subject: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          priority?: Database["public"]["Enums"]["ticket_priority"]
          status?: Database["public"]["Enums"]["ticket_status"]
          subject?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_message: {
        Row: {
          author_user_id: string | null
          body: string
          created_at: string
          id: string
          ticket_id: string
        }
        Insert: {
          author_user_id?: string | null
          body: string
          created_at?: string
          id?: string
          ticket_id: string
        }
        Update: {
          author_user_id?: string | null
          body?: string
          created_at?: string
          id?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_message_author_user_id_fkey"
            columns: ["author_user_id"]
            isOneToOne: false
            referencedRelation: "app_user"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_message_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "ticket"
            referencedColumns: ["id"]
          },
        ]
      }
      vacation_period: {
        Row: {
          employee_id: string
          end_date: string
          id: string
          start_date: string
        }
        Insert: {
          employee_id: string
          end_date: string
          id?: string
          start_date: string
        }
        Update: {
          employee_id?: string
          end_date?: string
          id?: string
          start_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "vacation_period_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee"
            referencedColumns: ["id"]
          },
        ]
      }
      vault_document: {
        Row: {
          company_id: string
          created_at: string
          file_url: string
          id: string
          pinned: boolean
          title: string
        }
        Insert: {
          company_id: string
          created_at?: string
          file_url: string
          id?: string
          pinned?: boolean
          title: string
        }
        Update: {
          company_id?: string
          created_at?: string
          file_url?: string
          id?: string
          pinned?: boolean
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "vault_document_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      app_current_company: { Args: never; Returns: string }
    }
    Enums: {
      billing_cycle: "MONTHLY" | "QUARTERLY" | "SEMIANNUAL" | "ANNUAL"
      category_kind: "INCOME" | "EXPENSE"
      company_type: "SERVICE" | "HOLDING"
      contract_status:
        | "DRAFT"
        | "ACTIVE"
        | "SUSPENDED"
        | "CANCELED"
        | "FINISHED"
      doc_status: "OPEN" | "PAID" | "OVERDUE"
      employee_status: "ACTIVE" | "ON_VACATION" | "TERMINATED"
      employment_event_type: "ADMISSION" | "TERMINATION"
      entry_status: "PENDING" | "PAID" | "OVERDUE" | "CANCELED"
      entry_type: "PAYABLE" | "RECEIVABLE"
      index_type: "IPCA" | "IGPM"
      integration_kind: "NFSE" | "ELECTRONIC_SIGNATURE" | "OPEN_FINANCE"
      invoice_status: "DRAFT" | "ISSUING" | "ISSUED" | "CANCELED" | "ERROR"
      lease_status: "ACTIVE" | "ENDED" | "CANCELED"
      notification_severity: "INFO" | "WARNING" | "URGENT"
      property_kind: "APARTMENT" | "HOUSE" | "COMMERCIAL" | "LAND" | "OTHER"
      property_status: "AVAILABLE" | "RENTED" | "MAINTENANCE" | "SOLD"
      reconciliation_status: "UNMATCHED" | "MATCHED" | "IGNORED"
      rent_invoice_status: "OPEN" | "PAID" | "OVERDUE" | "CANCELED"
      signature_status: "PENDING" | "SENT" | "SIGNED" | "REFUSED" | "EXPIRED"
      subscription_status: "ACTIVE" | "PAST_DUE" | "CANCELED" | "TRIAL"
      tax_regime: "SIMPLES_NACIONAL" | "LUCRO_PRESUMIDO" | "LUCRO_REAL"
      ticket_priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT"
      ticket_status:
        | "OPEN"
        | "IN_PROGRESS"
        | "WAITING_CLIENT"
        | "RESOLVED"
        | "CLOSED"
      user_role:
        | "OWNER"
        | "ADMIN"
        | "FINANCE"
        | "STAFF"
        | "ACCOUNTANT"
        | "VIEWER"
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
      billing_cycle: ["MONTHLY", "QUARTERLY", "SEMIANNUAL", "ANNUAL"],
      category_kind: ["INCOME", "EXPENSE"],
      company_type: ["SERVICE", "HOLDING"],
      contract_status: ["DRAFT", "ACTIVE", "SUSPENDED", "CANCELED", "FINISHED"],
      doc_status: ["OPEN", "PAID", "OVERDUE"],
      employee_status: ["ACTIVE", "ON_VACATION", "TERMINATED"],
      employment_event_type: ["ADMISSION", "TERMINATION"],
      entry_status: ["PENDING", "PAID", "OVERDUE", "CANCELED"],
      entry_type: ["PAYABLE", "RECEIVABLE"],
      index_type: ["IPCA", "IGPM"],
      integration_kind: ["NFSE", "ELECTRONIC_SIGNATURE", "OPEN_FINANCE"],
      invoice_status: ["DRAFT", "ISSUING", "ISSUED", "CANCELED", "ERROR"],
      lease_status: ["ACTIVE", "ENDED", "CANCELED"],
      notification_severity: ["INFO", "WARNING", "URGENT"],
      property_kind: ["APARTMENT", "HOUSE", "COMMERCIAL", "LAND", "OTHER"],
      property_status: ["AVAILABLE", "RENTED", "MAINTENANCE", "SOLD"],
      reconciliation_status: ["UNMATCHED", "MATCHED", "IGNORED"],
      rent_invoice_status: ["OPEN", "PAID", "OVERDUE", "CANCELED"],
      signature_status: ["PENDING", "SENT", "SIGNED", "REFUSED", "EXPIRED"],
      subscription_status: ["ACTIVE", "PAST_DUE", "CANCELED", "TRIAL"],
      tax_regime: ["SIMPLES_NACIONAL", "LUCRO_PRESUMIDO", "LUCRO_REAL"],
      ticket_priority: ["LOW", "MEDIUM", "HIGH", "URGENT"],
      ticket_status: [
        "OPEN",
        "IN_PROGRESS",
        "WAITING_CLIENT",
        "RESOLVED",
        "CLOSED",
      ],
      user_role: ["OWNER", "ADMIN", "FINANCE", "STAFF", "ACCOUNTANT", "VIEWER"],
    },
  },
} as const
