import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';

// ==========================================
// 📊 GENERADOR DE EXCEL
// ==========================================


export const generarExcelStream = async (data, coleccion) => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(`Reporte de ${coleccion}`);
  
    // 📐 Definición de columnas corporativas - KEYS SINCRONIZADAS CON ROWDATA
    if (coleccion === 'ventas') {
      worksheet.columns = [
        { header: 'N° Orden', key: 'numeroOrden', width: 15 },
        { header: 'Cliente / Comprador', key: 'clienteNombre', width: 28 },
        { header: 'Email', key: 'clienteEmail', width: 28 },
        { header: 'Total Facturado', key: 'total', width: 18, style: { numFmt: '$ #,##0.00' } },
        { header: 'Estado Pago', key: 'estado', width: 15 },
        { header: 'Fecha de Venta', key: 'createdAt', width: 18 },
      ];
    } else if (coleccion === 'productos') {
      worksheet.columns = [
        { header: 'Código Prod.', key: 'codigoProd', width: 15 },
        { header: 'Nombre del Producto', key: 'nombre', width: 32 },
        { header: 'Precio Lista', key: 'precio', width: 18, style: { numFmt: '$ #,##0.00' } },
        { header: 'Stock Disponible', key: 'stock', width: 18, style: { numFmt: '#,##0' } },
        { header: 'Estado', key: 'estado', width: 15 },
        { header: 'Fecha Alta', key: 'createdAt', width: 18 },
      ];
    } else {
      worksheet.columns = [
        { header: 'Código Interno', key: 'codigoUser', width: 15 },
        { header: 'Nombre Completo', key: 'nombre', width: 28 },
        { header: 'Email Registrado', key: 'email', width: 32 },
        { header: 'Rol Asignado', key: 'rol', width: 18 },
        { header: 'Fecha Alta', key: 'createdAt', width: 18 },
      ];
    }
  
    // 🎨 Estilos para la fila de encabezados (Cyan QDRON Store)
    const headerRow = worksheet.getRow(1);
    headerRow.height = 26;
    headerRow.font = { name: 'Segoe UI', bold: true, color: { argb: 'FFFFFF' }, size: 11 };
    
    headerRow.eachCell((cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: '0E7490' }
      };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    });
  
    // 🚚 Mapeo e inyección de filas sanitizadas
    data.forEach((item) => {
      const obj = item.toObject ? item.toObject() : item;
      let rowData = {};
  
      const fechaLimpia = obj.createdAt ? new Date(obj.createdAt).toISOString().split('T')[0] : 'N/A';
      const idCorto = obj._id ? obj._id.toString().slice(-6).toUpperCase() : 'N/A';
  
      if (coleccion === 'ventas') {
        rowData = {
          numeroOrden: idCorto,
          clienteNombre: obj.usuario?.nombre || 'Cliente Final',
          clienteEmail: obj.usuario?.email || 'S/D',
          total: Number(obj.total) || 0,
          estado: (obj.estado || 'Verificado').toUpperCase(),
          createdAt: fechaLimpia
        };
      } else if (coleccion === 'productos') {
        rowData = {
          codigoProd: idCorto,
          nombre: (obj.name || obj.nombre || 'Sin Nombre').toUpperCase(),
          precio: Number(obj.price || obj.precio || 0),
          stock: Number(obj.stock ?? obj.existenciasGeneral ?? obj.cantidadTotal ?? 0),
          estado: (obj.estado || 'Activo').toUpperCase(),
          createdAt: fechaLimpia
        };
      } else {
        rowData = {
          codigoUser: idCorto,
          nombre: (obj.nombre || 'S/N').toUpperCase(),
          email: obj.email || 'N/A',
          rol: (obj.role?.name || 'Usuario').toUpperCase(),
          createdAt: fechaLimpia
        };
      }
  
      const newRow = worksheet.addRow(rowData);
      newRow.height = 22;
      newRow.font = { name: 'Segoe UI', size: 10 };
      
      // Alineaciones de celdas seguras
      newRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
      newRow.getCell(worksheet.columns.length).alignment = { horizontal: 'center', vertical: 'middle' };
    });
  
    return workbook;
  };

// ==========================================
// 🖨️ GENERADOR DE PDF
// ==========================================
export const generarPDFDoc = (data, coleccion, res) => {
    const doc = new PDFDocument({ margin: 40, size: 'A4' });
  
    // Tubería directa a la respuesta HTTP Express
    doc.pipe(res);
  
    // Encabezado del PDF - Identidad Dron Store
    doc.fillColor('#0E7490').fontSize(22).font('Helvetica-Bold').text('QDRON Store - Analytics System', { align: 'center' });
    doc.moveDown(0.3);
    doc.fillColor('#64748B').fontSize(9).font('Helvetica-Bold').text(`REPORTE DE AUDITORÍA LOGÍSTICA / PLANILLA DE ${coleccion.toUpperCase()}`, { align: 'center' });
    
    // Regla divisoria del Header
    doc.moveDown(1);
    doc.moveTo(40, doc.y).lineTo(550, doc.y).strokeColor('#0E7490').lineWidth(2).stroke();
    doc.moveDown(1.5);
  
    // Renderizado explícito de bloques documentales
    data.forEach((item, index) => {
      const obj = item.toObject ? item.toObject() : item;
      
      const idCorto = obj._id ? obj._id.toString().slice(-6).toUpperCase() : 'N/A';
      const fechaLimpia = obj.createdAt ? new Date(obj.createdAt).toISOString().split('T')[0] : 'N/A';
  
      doc.fillColor('#0F172A').fontSize(11).font('Helvetica-Bold').text(`Registro #${index + 1} [Código: ${idCorto}]`);
      doc.moveDown(0.4);
  
      if (coleccion === 'ventas') {
        const clienteNombre = obj.usuario?.nombre || 'Cliente Final';
        const clienteEmail = obj.usuario?.email || 'S/D';
        const totalFormateado = obj.total ? `$ ${Number(obj.total).toLocaleString('es-AR')}` : '$ 0.00';
        const estadoVenta = (obj.estado || 'Verificado').toUpperCase();
        const nroVenta = obj.numeroVenta || index + 1;
  
        doc.fillColor('#334155').fontSize(10).font('Helvetica').text(`  • N° Operación Interna: `, { continued: true })
           .font('Helvetica-Bold').text(`${nroVenta}`);
        
        doc.font('Helvetica').text(`  • Nombre de Usuario / Cliente: `, { continued: true })
           .font('Helvetica-Bold').text(`${clienteNombre.toUpperCase()}`);
        
        doc.font('Helvetica').text(`  • Email Registrado: `, { continued: true })
           .font('Helvetica-Bold').text(`${clienteEmail}`);
        
        doc.font('Helvetica').text(`  • Liquidación Total: `, { continued: true })
           .font('Helvetica-Bold').fillColor('#0E7490').text(`${totalFormateado}`);
        
        doc.fillColor('#334155').font('Helvetica').text(`  • Estado de la Venta: `, { continued: true })
           .font('Helvetica-Bold').text(`${estadoVenta}`);
  
      } else if (coleccion === 'productos') {
        // 🚀 CORRECCIÓN DEFINITIVA: Mapeo exacto con variables 'name' y 'price'
        const nombreProducto = obj.name || obj.nombre || 'Sin Especificar';
        const precioUnitario = obj.price || obj.precio || 0;
        const precioFormateado = `$ ${Number(precioUnitario).toLocaleString('es-AR')}`;
        const stockActual = obj.stock ?? obj.existenciasGeneral ?? obj.cantidadTotal ?? 0;
  
        doc.fillColor('#334155').fontSize(10).font('Helvetica').text(`  • Dron / Producto: `, { continued: true })
           .font('Helvetica-Bold').text(`${nombreProducto.toUpperCase()}`);
        
        doc.font('Helvetica').text(`  • Precio Unitario: `, { continued: true })
           .font('Helvetica-Bold').fillColor('#0E7490').text(`${precioFormateado}`);
        
        doc.fillColor('#334155').font('Helvetica').text(`  • Stock en Depósito: `, { continued: true })
           .font('Helvetica-Bold').text(`${stockActual} U.`);
        
        doc.font('Helvetica').text(`  • Estado de Carga: `, { continued: true })
           .font('Helvetica-Bold').text(`${(obj.estado || 'ACTIVO').toUpperCase()}`);
  
      } else {
        doc.fillColor('#334155').fontSize(10).font('Helvetica').text(`  • Operador Técnico: `, { continued: true })
           .font('Helvetica-Bold').text(`${(obj.nombre || 'S/N').toUpperCase()}`);
        
        doc.font('Helvetica').text(`  • Email de Cuenta: `, { continued: true })
           .font('Helvetica-Bold').text(`${obj.email || 'N/A'}`);
        
        doc.font('Helvetica').text(`  • Rol de Sistema: `, { continued: true })
           .font('Helvetica-Bold').text(`${(obj.role?.name || 'USUARIO').toUpperCase()}`);
      }
  
      doc.fillColor('#64748B').fontSize(8).font('Helvetica-Oblique').text(`  • Sincronizado el: ${fechaLimpia}`, { align: 'right' });
  
      // Línea separadora gris minimalista
      doc.moveDown(0.8);
      doc.moveTo(40, doc.y).lineTo(550, doc.y).strokeColor('#E2E8F0').lineWidth(0.8).stroke();
      doc.moveDown(1.2);
    });
  
    doc.end();
  }