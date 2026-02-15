import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, History, Eye, ChevronLeft, ChevronRight, User, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { useJournalTemplateAudit, JournalTemplateAuditLog } from '@/hooks/useJournalTemplateAudit';

interface JournalTemplateAuditLogProps {
  templateId?: string;
}

export const JournalTemplateAuditLogComponent = ({ templateId }: JournalTemplateAuditLogProps) => {
  const { logs, loading, page, setPage, pageSize, getActionLabel, getActionColor } = useJournalTemplateAudit(templateId);
  const [selectedLog, setSelectedLog] = useState<JournalTemplateAuditLog | null>(null);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="text-center text-muted-foreground">
            <History className="h-10 w-10 mx-auto mb-2 opacity-50" />
            <p>Belum ada riwayat perubahan</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <History className="h-4 w-4" />
            Riwayat Perubahan Template
          </CardTitle>
          <CardDescription>
            Audit trail untuk semua perubahan konfigurasi template jurnal
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-40">Waktu</TableHead>
                <TableHead>Template</TableHead>
                <TableHead className="w-32">Aksi</TableHead>
                <TableHead>Keterangan</TableHead>
                <TableHead className="w-40">Oleh</TableHead>
                <TableHead className="w-16">Detail</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map(log => (
                <TableRow key={log.id}>
                  <TableCell className="text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {format(new Date(log.created_at), 'dd MMM yyyy HH:mm', { locale: idLocale })}
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">
                    {log.template_name || '-'}
                  </TableCell>
                  <TableCell>
                    <Badge className={getActionColor(log.action)}>
                      {getActionLabel(log.action)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">
                    {log.change_summary || '-'}
                  </TableCell>
                  <TableCell className="text-sm">
                    {log.changed_by_name ? (
                      <div className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {log.changed_by_name}
                      </div>
                    ) : '-'}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setSelectedLog(log)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {/* Pagination */}
          <div className="flex items-center justify-between mt-4">
            <p className="text-sm text-muted-foreground">
              Menampilkan {logs.length} dari halaman {page}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(page - 1)}
                disabled={page <= 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(page + 1)}
                disabled={logs.length < pageSize}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Detail Perubahan
            </DialogTitle>
            <DialogDescription>
              {selectedLog?.change_summary}
            </DialogDescription>
          </DialogHeader>

          {selectedLog && (
            <ScrollArea className="max-h-[60vh]">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Waktu</p>
                    <p className="font-medium">
                      {format(new Date(selectedLog.created_at), 'dd MMMM yyyy HH:mm:ss', { locale: idLocale })}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Diubah oleh</p>
                    <p className="font-medium">{selectedLog.changed_by_name || '-'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Template</p>
                    <p className="font-medium">{selectedLog.template_name || '-'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Aksi</p>
                    <Badge className={getActionColor(selectedLog.action)}>
                      {getActionLabel(selectedLog.action)}
                    </Badge>
                  </div>
                </div>

                {selectedLog.old_data && (
                  <div>
                    <p className="text-sm font-medium mb-2 text-muted-foreground">Data Sebelum:</p>
                    <pre className="text-xs bg-muted p-3 rounded-md overflow-x-auto">
                      {JSON.stringify(selectedLog.old_data, null, 2)}
                    </pre>
                  </div>
                )}

                {selectedLog.new_data && (
                  <div>
                    <p className="text-sm font-medium mb-2 text-muted-foreground">Data Sesudah:</p>
                    <pre className="text-xs bg-muted p-3 rounded-md overflow-x-auto">
                      {JSON.stringify(selectedLog.new_data, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};
