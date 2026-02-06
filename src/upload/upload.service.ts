import { Injectable } from '@nestjs/common';
import { join } from 'path';
import { unlink } from 'fs/promises';

/**
 * Servicio de gestión de archivos subidos.
 * Responsable de la limpieza de disco cuando se reemplazan o eliminan referencias a uploads propios.
 */
@Injectable()
export class UploadService {
  private readonly uploadsDir: string;

  constructor() {
    this.uploadsDir = join(process.cwd(), 'uploads');
  }

  /**
   * Indica si la URL apunta a un archivo subido por nuestro servidor (path /uploads/...).
   */
  isOwnUploadUrl(url: string | null | undefined): boolean {
    if (!url || typeof url !== 'string') return false;
    try {
      const parsed = new URL(url);
      const pathname = parsed.pathname || '';
      return pathname.includes('/uploads/') && pathname.split('/').filter(Boolean).length >= 2;
    } catch {
      return false;
    }
  }

  /**
   * Obtiene la ruta absoluta en disco a partir de una URL de upload propio.
   * Devuelve null si la URL no es de nuestro /uploads/.
   */
  getFilePathFromUrl(url: string): string | null {
    if (!this.isOwnUploadUrl(url)) return null;
    try {
      const parsed = new URL(url);
      const pathname = parsed.pathname || '';
      const segments = pathname.split('/').filter(Boolean);
      const uploadsIndex = segments.indexOf('uploads');
      if (uploadsIndex === -1 || uploadsIndex === segments.length - 1) return null;
      const filename = segments.slice(uploadsIndex + 1).join('/');
      if (!filename) return null;
      return join(this.uploadsDir, filename);
    } catch {
      return null;
    }
  }

  /**
   * Elimina el archivo en disco si la URL corresponde a un upload propio.
   * Ignora errores ENOENT (archivo ya no existe).
   */
  async deleteFileFromUrl(url: string): Promise<void> {
    const filePath = this.getFilePathFromUrl(url);
    if (!filePath) return;
    try {
      await unlink(filePath);
    } catch (err: unknown) {
      const code = err && typeof err === 'object' && 'code' in err ? (err as NodeJS.ErrnoException).code : undefined;
      if (code !== 'ENOENT') throw err;
    }
  }
}
