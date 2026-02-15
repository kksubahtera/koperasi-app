import { createAndDownloadExcel, SheetData } from './excelUtils';
import { formatCurrency, formatDate, getTransactionTypeLabel, getStatusLabel } from './mockData';
import { supabase } from '@/integrations/supabase/client';

/**
 * Escapes HTML special characters to prevent XSS attacks in print windows
 * This MUST be used for all user-controlled data inserted into HTML templates
 */
export const escapeHtml = (str: string | null | undefined): string => {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

export interface ExportTransaction {
  id: string;
  memberName?: string;
  memberNumber?: string;
  type: string;
  amount: number;
  date: string | null;
  status: string;
  paymentMethod: string;
  accountHolderName?: string | null;
  notes?: string | null;
  createdAt?: string | null;
}

export interface ExportMember {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  nik?: string | null;
  memberNumber?: string | null;
  bankAccountNumber?: string | null;
  bankAccountName?: string | null;
  isActive: boolean;
  approvalStatus?: string | null;
  joinDate?: string | null;
  exitDate?: string | null;
}

const getPaymentMethodLabel = (method: string): string => {
  switch (method) {
    case 'transfer_bank':
      return 'Transfer Bank';
    case 'e_wallet':
      return 'E-Wallet';
    default:
      return method;
  }
};

// Fetch all transactions with pagination for export
export const fetchAllTransactionsForExport = async (
  onProgress?: (loaded: number, total: number) => void
): Promise<ExportTransaction[]> => {
  const PAGE_SIZE = 100;
  let allTransactions: ExportTransaction[] = [];
  let page = 0;
  let hasMore = true;

  // First get total count
  const { count } = await supabase
    .from('transactions')
    .select('*', { count: 'exact', head: true });

  const totalCount = count || 0;

  while (hasMore) {
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    const { data: transactions, error } = await supabase
      .from('transactions')
      .select('*')
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) throw error;

    if (!transactions || transactions.length === 0) {
      hasMore = false;
      continue;
    }

    // Fetch profiles for these transactions
    const userIds = [...new Set(transactions.map(t => t.user_id))];
    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, name, member_number')
      .in('user_id', userIds);

    const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

    const transformedTransactions = transactions.map(t => ({
      id: t.id,
      memberName: profileMap.get(t.user_id)?.name,
      memberNumber: profileMap.get(t.user_id)?.member_number || undefined,
      type: t.type,
      amount: t.amount,
      date: t.date,
      status: t.status,
      paymentMethod: t.payment_method,
      accountHolderName: t.account_holder_name,
      notes: t.notes,
      createdAt: t.created_at,
    }));

    allTransactions = [...allTransactions, ...transformedTransactions];
    
    if (onProgress) {
      onProgress(allTransactions.length, totalCount);
    }

    if (transactions.length < PAGE_SIZE) {
      hasMore = false;
    } else {
      page++;
    }
  }

  return allTransactions;
};

// Fetch all members with pagination for export
export const fetchAllMembersForExport = async (
  options?: { isActive?: boolean; approvalStatus?: string },
  onProgress?: (loaded: number, total: number) => void
): Promise<ExportMember[]> => {
  const PAGE_SIZE = 100;
  let allMembers: ExportMember[] = [];
  let page = 0;
  let hasMore = true;

  // Build count query
  let countQuery = supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true });

  if (options?.isActive !== undefined) {
    countQuery = countQuery.eq('is_active', options.isActive);
  }
  if (options?.approvalStatus) {
    countQuery = countQuery.eq('approval_status', options.approvalStatus);
  }

  const { count } = await countQuery;
  const totalCount = count || 0;

  while (hasMore) {
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    let query = supabase
      .from('profiles')
      .select('*')
      .order('name', { ascending: true })
      .range(from, to);

    if (options?.isActive !== undefined) {
      query = query.eq('is_active', options.isActive);
    }
    if (options?.approvalStatus) {
      query = query.eq('approval_status', options.approvalStatus);
    }

    const { data: members, error } = await query;

    if (error) throw error;

    if (!members || members.length === 0) {
      hasMore = false;
      continue;
    }

    const transformedMembers = members.map(m => ({
      id: m.user_id,
      name: m.name,
      email: m.email,
      phone: m.phone,
      nik: null, // NIK is now encrypted - not included in export for security
      memberNumber: m.member_number,
      bankAccountNumber: m.bank_account_number,
      bankAccountName: m.bank_account_name,
      isActive: m.is_active ?? true,
      approvalStatus: m.approval_status,
      joinDate: m.join_date,
      exitDate: m.exit_date,
    }));

    allMembers = [...allMembers, ...transformedMembers];
    
    if (onProgress) {
      onProgress(allMembers.length, totalCount);
    }

    if (members.length < PAGE_SIZE) {
      hasMore = false;
    } else {
      page++;
    }
  }

  return allMembers;
};

// Export members to Excel
export const exportMembersToExcel = async (
  members: ExportMember[],
  filename: string = 'data-anggota',
  language: 'id' | 'en' = 'id'
) => {
  const headers = language === 'id' 
    ? ['No', 'Nama', 'No. Anggota', 'NIK', 'Email', 'Telepon', 'No. Rekening', 'Nama Rekening', 'Status', 'Tgl Bergabung', 'Tgl Keluar']
    : ['No', 'Name', 'Member No.', 'ID Number', 'Email', 'Phone', 'Bank Account', 'Account Name', 'Status', 'Join Date', 'Exit Date'];

  const data = members.map((member, index) => [
    index + 1,
    member.name,
    member.memberNumber || '-',
    member.nik || '-',
    member.email,
    member.phone || '-',
    member.bankAccountNumber || '-',
    member.bankAccountName || '-',
    member.isActive ? (language === 'id' ? 'Aktif' : 'Active') : (language === 'id' ? 'Nonaktif' : 'Inactive'),
    member.joinDate ? formatDate(member.joinDate) : '-',
    member.exitDate ? formatDate(member.exitDate) : '-',
  ]);

  const activeCount = members.filter(m => m.isActive).length;
  const inactiveCount = members.filter(m => !m.isActive).length;

  const summaryData = language === 'id' 
    ? [
        ['Ringkasan Data Anggota', ''],
        ['', ''],
        ['Total Anggota', members.length.toString()],
        ['Anggota Aktif', activeCount.toString()],
        ['Anggota Nonaktif', inactiveCount.toString()],
        ['', ''],
        ['Tanggal Export', formatDate(new Date().toISOString())],
      ]
    : [
        ['Member Data Summary', ''],
        ['', ''],
        ['Total Members', members.length.toString()],
        ['Active Members', activeCount.toString()],
        ['Inactive Members', inactiveCount.toString()],
        ['', ''],
        ['Export Date', formatDate(new Date().toISOString())],
      ];

  const sheets: SheetData[] = [
    {
      name: language === 'id' ? 'Anggota' : 'Members',
      data: [headers, ...data],
      columns: [
        { width: 5 }, { width: 25 }, { width: 15 }, { width: 18 },
        { width: 25 }, { width: 15 }, { width: 20 }, { width: 20 },
        { width: 10 }, { width: 12 }, { width: 12 }
      ]
    },
    {
      name: language === 'id' ? 'Ringkasan' : 'Summary',
      data: summaryData,
      columns: [{ width: 25 }, { width: 20 }]
    }
  ];

  const dateStr = new Date().toISOString().split('T')[0];
  await createAndDownloadExcel(sheets, `${filename}-${dateStr}.xlsx`);
};

// Export members to PDF
export const exportMembersToPDF = (
  members: ExportMember[],
  filename: string = 'data-anggota',
  language: 'id' | 'en' = 'id',
  title?: string
) => {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert(language === 'id' ? 'Popup diblokir. Izinkan popup untuk mencetak.' : 'Popup blocked. Allow popups to print.');
    return;
  }

  const activeCount = members.filter(m => m.isActive).length;
  const inactiveCount = members.filter(m => !m.isActive).length;
  const reportTitle = title || (language === 'id' ? 'Data Anggota Koperasi' : 'Cooperative Member Data');

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>${reportTitle}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
          padding: 20px;
          font-size: 11px;
          color: #1a1a1a;
        }
        .header { 
          text-align: center; 
          margin-bottom: 30px;
          padding-bottom: 20px;
          border-bottom: 2px solid #e5e7eb;
        }
        .header h1 { font-size: 24px; font-weight: 700; margin-bottom: 8px; }
        .header p { color: #6b7280; }
        .summary { display: flex; gap: 16px; margin-bottom: 24px; flex-wrap: wrap; }
        .summary-card {
          flex: 1; min-width: 120px; background: #f9fafb;
          border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px 16px;
        }
        .summary-card .label { color: #6b7280; font-size: 11px; margin-bottom: 4px; }
        .summary-card .value { font-size: 18px; font-weight: 700; }
        .summary-card .value.success { color: #059669; }
        .summary-card .value.error { color: #dc2626; }
        table { width: 100%; border-collapse: collapse; margin-top: 16px; }
        th, td { padding: 8px 6px; text-align: left; border-bottom: 1px solid #e5e7eb; }
        th { background: #f9fafb; font-weight: 600; font-size: 10px; text-transform: uppercase; color: #6b7280; }
        tr:hover { background: #f9fafb; }
        .status { display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 10px; font-weight: 500; }
        .status-active { background: #d1fae5; color: #059669; }
        .status-inactive { background: #f3f4f6; color: #6b7280; }
        .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center; color: #6b7280; font-size: 11px; }
        @media print { body { padding: 0; } .no-print { display: none; } }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>${reportTitle}</h1>
        <p>${language === 'id' ? 'Dicetak pada' : 'Printed on'}: ${formatDate(new Date().toISOString())}</p>
      </div>
      <div class="summary">
        <div class="summary-card">
          <div class="label">${language === 'id' ? 'Total Anggota' : 'Total Members'}</div>
          <div class="value">${members.length}</div>
        </div>
        <div class="summary-card">
          <div class="label">${language === 'id' ? 'Aktif' : 'Active'}</div>
          <div class="value success">${activeCount}</div>
        </div>
        <div class="summary-card">
          <div class="label">${language === 'id' ? 'Nonaktif' : 'Inactive'}</div>
          <div class="value error">${inactiveCount}</div>
        </div>
      </div>
      <table>
        <thead>
          <tr>
            <th>No</th>
            <th>${language === 'id' ? 'Nama' : 'Name'}</th>
            <th>${language === 'id' ? 'No. Anggota' : 'Member No.'}</th>
            <th>Email</th>
            <th>${language === 'id' ? 'Telepon' : 'Phone'}</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${members.map((m, i) => `
            <tr>
              <td>${i + 1}</td>
              <td><strong>${escapeHtml(m.name)}</strong></td>
              <td>${escapeHtml(m.memberNumber) || '-'}</td>
              <td>${escapeHtml(m.email)}</td>
              <td>${escapeHtml(m.phone) || '-'}</td>
              <td>
                <span class="status status-${m.isActive ? 'active' : 'inactive'}">
                  ${m.isActive ? (language === 'id' ? 'Aktif' : 'Active') : (language === 'id' ? 'Nonaktif' : 'Inactive')}
                </span>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      <div class="footer">
        <p>${language === 'id' ? 'Dokumen ini digenerate secara otomatis.' : 'This document was automatically generated.'}</p>
      </div>
      <script>window.onload = function() { window.print(); };</script>
    </body>
    </html>
  `;

  printWindow.document.write(html);
  printWindow.document.close();
};

export const exportToExcel = async (
  transactions: ExportTransaction[],
  filename: string = 'laporan-transaksi',
  language: 'id' | 'en' = 'id'
) => {
  const headers = language === 'id' 
    ? ['No', 'Tanggal', 'Nama Anggota', 'No. Anggota', 'Jenis Transaksi', 'Jumlah', 'Status', 'Metode Pembayaran', 'Nama Pengirim', 'Catatan']
    : ['No', 'Date', 'Member Name', 'Member No.', 'Transaction Type', 'Amount', 'Status', 'Payment Method', 'Sender Name', 'Notes'];

  const data = transactions.map((tx, index) => [
    index + 1,
    tx.date ? formatDate(tx.date) : '-',
    tx.memberName || '-',
    tx.memberNumber || '-',
    getTransactionTypeLabel(tx.type as any, language),
    formatCurrency(tx.amount),
    getStatusLabel(tx.status as any, language),
    getPaymentMethodLabel(tx.paymentMethod),
    tx.accountHolderName || '-',
    tx.notes || '-'
  ]);

  const summaryData = calculateSummary(transactions, language);

  const sheets: SheetData[] = [
    {
      name: language === 'id' ? 'Transaksi' : 'Transactions',
      data: [headers, ...data],
      columns: [
        { width: 5 }, { width: 12 }, { width: 25 }, { width: 18 },
        { width: 25 }, { width: 18 }, { width: 12 }, { width: 15 },
        { width: 20 }, { width: 30 }
      ]
    },
    {
      name: language === 'id' ? 'Ringkasan' : 'Summary',
      data: summaryData,
      columns: [{ width: 25 }, { width: 20 }]
    }
  ];

  const dateStr = new Date().toISOString().split('T')[0];
  await createAndDownloadExcel(sheets, `${filename}-${dateStr}.xlsx`);
};

const calculateSummary = (transactions: ExportTransaction[], language: 'id' | 'en'): string[][] => {
  const approved = transactions.filter(t => t.status === 'approved');
  const pending = transactions.filter(t => t.status === 'pending');
  const rejected = transactions.filter(t => t.status === 'rejected');

  const totalApproved = approved.reduce((sum, t) => sum + t.amount, 0);
  const totalPending = pending.reduce((sum, t) => sum + t.amount, 0);

  if (language === 'id') {
    return [
      ['Ringkasan Laporan Transaksi', ''],
      ['', ''],
      ['Total Transaksi', transactions.length.toString()],
      ['Transaksi Disetujui', approved.length.toString()],
      ['Transaksi Menunggu', pending.length.toString()],
      ['Transaksi Ditolak', rejected.length.toString()],
      ['', ''],
      ['Total Nilai (Disetujui)', formatCurrency(totalApproved)],
      ['Total Nilai (Menunggu)', formatCurrency(totalPending)],
      ['', ''],
      ['Tanggal Export', formatDate(new Date().toISOString())],
    ];
  }

  return [
    ['Transaction Report Summary', ''],
    ['', ''],
    ['Total Transactions', transactions.length.toString()],
    ['Approved Transactions', approved.length.toString()],
    ['Pending Transactions', pending.length.toString()],
    ['Rejected Transactions', rejected.length.toString()],
    ['', ''],
    ['Total Value (Approved)', formatCurrency(totalApproved)],
    ['Total Value (Pending)', formatCurrency(totalPending)],
    ['', ''],
    ['Export Date', formatDate(new Date().toISOString())],
  ];
};

export const exportToPDF = (
  transactions: ExportTransaction[],
  filename: string = 'laporan-transaksi',
  language: 'id' | 'en' = 'id',
  title?: string
) => {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert(language === 'id' ? 'Popup diblokir. Izinkan popup untuk mencetak.' : 'Popup blocked. Allow popups to print.');
    return;
  }

  const approved = transactions.filter(t => t.status === 'approved');
  const pending = transactions.filter(t => t.status === 'pending');
  const rejected = transactions.filter(t => t.status === 'rejected');
  const totalApproved = approved.reduce((sum, t) => sum + t.amount, 0);

  const reportTitle = title || (language === 'id' ? 'Laporan Transaksi' : 'Transaction Report');

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>${reportTitle}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
          padding: 20px;
          font-size: 12px;
          color: #1a1a1a;
        }
        .header { 
          text-align: center; 
          margin-bottom: 30px;
          padding-bottom: 20px;
          border-bottom: 2px solid #e5e7eb;
        }
        .header h1 { 
          font-size: 24px; 
          font-weight: 700;
          margin-bottom: 8px;
        }
        .header p { color: #6b7280; }
        .summary {
          display: flex;
          gap: 16px;
          margin-bottom: 24px;
          flex-wrap: wrap;
        }
        .summary-card {
          flex: 1;
          min-width: 120px;
          background: #f9fafb;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          padding: 12px 16px;
        }
        .summary-card .label { color: #6b7280; font-size: 11px; margin-bottom: 4px; }
        .summary-card .value { font-size: 18px; font-weight: 700; }
        .summary-card .value.success { color: #059669; }
        .summary-card .value.warning { color: #d97706; }
        .summary-card .value.error { color: #dc2626; }
        table { 
          width: 100%; 
          border-collapse: collapse;
          margin-top: 16px;
        }
        th, td { 
          padding: 10px 8px; 
          text-align: left; 
          border-bottom: 1px solid #e5e7eb;
        }
        th { 
          background: #f9fafb; 
          font-weight: 600;
          font-size: 11px;
          text-transform: uppercase;
          color: #6b7280;
        }
        tr:hover { background: #f9fafb; }
        .amount { text-align: right; font-weight: 600; }
        .status {
          display: inline-block;
          padding: 2px 8px;
          border-radius: 12px;
          font-size: 10px;
          font-weight: 500;
        }
        .status-approved { background: #d1fae5; color: #059669; }
        .status-pending { background: #fef3c7; color: #d97706; }
        .status-rejected { background: #fee2e2; color: #dc2626; }
        .footer {
          margin-top: 30px;
          padding-top: 20px;
          border-top: 1px solid #e5e7eb;
          text-align: center;
          color: #6b7280;
          font-size: 11px;
        }
        @media print {
          body { padding: 0; }
          .no-print { display: none; }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>${reportTitle}</h1>
        <p>${language === 'id' ? 'Dicetak pada' : 'Printed on'}: ${formatDate(new Date().toISOString())}</p>
      </div>

      <div class="summary">
        <div class="summary-card">
          <div class="label">${language === 'id' ? 'Total Transaksi' : 'Total Transactions'}</div>
          <div class="value">${transactions.length}</div>
        </div>
        <div class="summary-card">
          <div class="label">${language === 'id' ? 'Disetujui' : 'Approved'}</div>
          <div class="value success">${approved.length}</div>
        </div>
        <div class="summary-card">
          <div class="label">${language === 'id' ? 'Menunggu' : 'Pending'}</div>
          <div class="value warning">${pending.length}</div>
        </div>
        <div class="summary-card">
          <div class="label">${language === 'id' ? 'Ditolak' : 'Rejected'}</div>
          <div class="value error">${rejected.length}</div>
        </div>
        <div class="summary-card">
          <div class="label">${language === 'id' ? 'Total Nilai (Disetujui)' : 'Total Value (Approved)'}</div>
          <div class="value">${formatCurrency(totalApproved)}</div>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>No</th>
            <th>${language === 'id' ? 'Tanggal' : 'Date'}</th>
            <th>${language === 'id' ? 'Anggota' : 'Member'}</th>
            <th>${language === 'id' ? 'Jenis' : 'Type'}</th>
            <th class="amount">${language === 'id' ? 'Jumlah' : 'Amount'}</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${transactions.map((tx, i) => `
            <tr>
              <td>${i + 1}</td>
              <td>${tx.date ? formatDate(tx.date) : '-'}</td>
              <td>
                <strong>${escapeHtml(tx.memberName) || '-'}</strong><br>
                <span style="color: #6b7280; font-size: 10px;">${escapeHtml(tx.memberNumber) || '-'}</span>
              </td>
              <td>${getTransactionTypeLabel(tx.type as any, language)}</td>
              <td class="amount">${formatCurrency(tx.amount)}</td>
              <td>
                <span class="status status-${tx.status}">
                  ${getStatusLabel(tx.status as any, language)}
                </span>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <div class="footer">
        <p>${language === 'id' ? 'Dokumen ini digenerate secara otomatis.' : 'This document was automatically generated.'}</p>
      </div>

      <script>
        window.onload = function() { window.print(); };
      </script>
    </body>
    </html>
  `;

  printWindow.document.write(html);
  printWindow.document.close();
};

// Generic export to Excel for any data array
export const exportGenericToExcel = async (
  data: Record<string, any>[],
  filename: string = 'export-data'
) => {
  if (data.length === 0) return;

  // Get headers from first object keys
  const headers = Object.keys(data[0]);
  
  // Convert data to array of arrays
  const rows = data.map(item => headers.map(key => {
    const value = item[key];
    // Format numbers as currency if they look like money amounts
    if (typeof value === 'number' && value > 1000) {
      return formatCurrency(value);
    }
    return value ?? '-';
  }));

  const sheets: SheetData[] = [
    {
      name: 'Data',
      data: [headers, ...rows],
      columns: headers.map(header => ({ width: Math.max(header.length, 15) }))
    }
  ];

  const dateStr = new Date().toISOString().split('T')[0];
  await createAndDownloadExcel(sheets, `${filename}-${dateStr}.xlsx`);
};
