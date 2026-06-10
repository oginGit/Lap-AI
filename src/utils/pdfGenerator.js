/**
 * pdfGenerator.js
 * Generates a professional, single-page, purple-themed PDF report.
 */

import jsPDF from 'jspdf';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const PURPLE = [139, 92, 246];
const BG_DARK = [10, 10, 15];
const TEXT_LIGHT = [248, 249, 250];
const TEXT_MUTED = [161, 165, 181];

const addSectionTitle = (doc, title, y) => {
  doc.setDrawColor(...PURPLE);
  doc.setLineWidth(0.4);
  doc.line(14, y, 196, y);
  y += 4;

  doc.setTextColor(...PURPLE);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text(title.toUpperCase(), 14, y);
  return y + 5;
};

const addMetricRow = (doc, label, value, y, unit = '', labelX = 14, valueX = 110) => {
  doc.setTextColor(...TEXT_MUTED);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(label, labelX, y);

  doc.setTextColor(...TEXT_LIGHT);
  doc.setFont('helvetica', 'bold');
  doc.text(`${value}${unit}`, valueX, y);
  return y + 4.5;
};

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------
export const generatePDFReport = (hardware, llmAnalysis, userResponses) => {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageWidth = 210;
  const pageHeight = 297;

  const checkPageOverflow = (currentY, needed) => {
    if (currentY + needed > 280) {
      doc.addPage();
      doc.setFillColor(...BG_DARK);
      doc.rect(0, 0, pageWidth, pageHeight, 'F');
      return 20; // reset Y
    }
    return currentY;
  };

  // Background
  doc.setFillColor(...BG_DARK);
  doc.rect(0, 0, pageWidth, pageHeight, 'F');

  // Enhanced Header
  doc.setFillColor(...PURPLE);
  doc.rect(0, 0, pageWidth, 40, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text('LAPGUARD-AI', 14, 18);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Care beyond maintenance', 14, 25);
  
  doc.setFontSize(8);
  doc.setTextColor(230, 230, 230);
  doc.text('PROFESSIONAL HARDWARE HEALTH & MAINTENANCE REPORT', 14, 32);

  // Large Score Circle (Top Right)
  const healthScore = hardware?.overallHealth ?? 0;
  const hColor = healthScore >= 80 ? [16, 185, 129] : healthScore >= 60 ? [245, 158, 11] : [239, 68, 68];
  
  doc.setFillColor(20, 20, 30);
  doc.circle(175, 20, 15, 'F');
  doc.setDrawColor(...hColor);
  doc.setLineWidth(1.5);
  doc.circle(175, 20, 15, 'S');
  
  doc.setTextColor(...hColor);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(`${healthScore}`, 175, 21, { align: 'center' });
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(6);
  doc.text('OVERALL HEALTH', 175, 27, { align: 'center' });

  let y = 50;

  // 1. CPU Health
  y = addSectionTitle(doc, '1. CPU Health Status', y);
  if (hardware?.cpu) {
    y = addMetricRow(doc, 'Processor Model', hardware.cpu.model, y);
    y = addMetricRow(doc, 'Temperature', `${hardware.cpu.temperature}°C`, y);
    y = addMetricRow(doc, 'Current Usage', `${hardware.cpu.usage}%`, y);
    y = addMetricRow(doc, 'Clock Speed', `${hardware.cpu.speed} GHz`, y);
    y = addMetricRow(doc, 'Remaining Useful Life', `${hardware.cpu.rul} Months (Estimated)`, y);
    y += 6;
  }

  // 2. Battery Health
  y = checkPageOverflow(y, 40);
  y = addSectionTitle(doc, '2. Battery Health Status', y);
  if (hardware?.battery) {
    y = addMetricRow(doc, 'Current Level', `${hardware.battery.percent}%`, y);
    y = addMetricRow(doc, 'Health Score', `${hardware.battery.health}%`, y);
    y = addMetricRow(doc, 'Charge Cycles', `${hardware.battery.cycles}`, y);
    y = addMetricRow(doc, 'Voltage', `${hardware.battery.voltage}V`, y);
    y = addMetricRow(doc, 'Remaining Useful Life', `${hardware.battery.rul} Months (Estimated)`, y);
    y += 6;
  }

  // 3. Storage Health
  y = checkPageOverflow(y, 40);
  y = addSectionTitle(doc, '3. Storage Device Health', y);
  if (hardware?.drive) {
    y = addMetricRow(doc, 'Model', hardware.drive.model, y);
    y = addMetricRow(doc, 'Type / Interface', `${hardware.drive.type}`, y);
    y = addMetricRow(doc, 'SMART Health Score', `${hardware.drive.health}%`, y);
    y = addMetricRow(doc, 'Operating Temp', `${hardware.drive.temperature}°C`, y);
    const driveUsed = typeof hardware.drive.used === 'number' ? hardware.drive.used : (hardware.drive.used_gb || 0);
    const driveTotal = typeof hardware.drive.total === 'number' ? hardware.drive.total : (hardware.drive.total_gb || 0);
    y = addMetricRow(doc, 'Storage Used', `${driveUsed.toFixed(1)} / ${driveTotal} GB`, y);
    y += 6;
  }

  // 4. User Symptoms
  y = checkPageOverflow(y, 30);
  y = addSectionTitle(doc, '4. User Reported Symptoms', y);
  const issue = (userResponses?.issue || '').toLowerCase();
  const issueOther = (userResponses?.issueOther || '').toLowerCase();

  const isSlow = issue === 'slow' || issueOther.includes('slow') || issueOther.includes('lag');
  const isOverheating = issue === 'overheating' || issue === 'noise' || issueOther.includes('heat') || issueOther.includes('fan') || issueOther.includes('noise');
  const isShutdown = issue === 'shutdown' || issueOther.includes('shutdown') || issueOther.includes('restart');
  const isBattery = issueOther.includes('battery') || issueOther.includes('drain');

  const s1 = isShutdown ? 'Unexpected shutdowns reported' : 'No sudden shutdowns';
  const s2 = isBattery ? 'Rapid battery drain reported' : 'Stable battery discharge';
  const s3 = isOverheating ? 'Unusual noises/heating reported' : isSlow ? 'Performance slowdown reported' : 'Normal thermal behavior';
  y = addMetricRow(doc, 'Physical Impact', s1, y);
  y = addMetricRow(doc, 'Power Behavior', s2, y);
  y = addMetricRow(doc, 'Thermal/Acoustic', s3, y);
  y += 6;

  // 5. AI Analysis & Recommendations
  if (llmAnalysis) {
    y = checkPageOverflow(y, 60);
    y = addSectionTitle(doc, '5. AI Recommendations & Analysis', y);
    
    doc.setTextColor(...TEXT_LIGHT);
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    const summaryLines = doc.splitTextToSize(llmAnalysis.summary, 180);
    doc.text(summaryLines, 14, y);
    y += summaryLines.length * 4.5 + 4;

    if (llmAnalysis.combined_insight) {
      doc.setTextColor(...PURPLE);
      doc.setFont('helvetica', 'italic');
      const insightLines = doc.splitTextToSize(`Expert Insight: ${llmAnalysis.combined_insight}`, 180);
      doc.text(insightLines, 14, y);
      y += insightLines.length * 4.5 + 6;
    }

    // Actions
    if (llmAnalysis.actions?.length) {
      doc.setTextColor(...TEXT_LIGHT);
      doc.setFont('helvetica', 'bold');
      doc.text('PROPOSED ACTIONS:', 14, y);
      y += 4;
      doc.setFont('helvetica', 'normal');
      llmAnalysis.actions.slice(0, 4).forEach(action => {
        const lines = doc.splitTextToSize(`• ${action}`, 175);
        y = checkPageOverflow(y, lines.length * 4);
        doc.text(lines, 18, y);
        y += lines.length * 4 + 1;
      });
      y += 4;
    }
  }

  // 6. Chatbot Assistant Q&A
  try {
    const history = JSON.parse(localStorage.getItem('laptopmd_chat_history') || '[]');
    const lastChat = history.find(c => c.messages && c.messages.length > 1);
    if (lastChat) {
      y = checkPageOverflow(y, 40);
      y = addSectionTitle(doc, '6. AI Assistant Consultation', y);
      const messages = lastChat.messages.slice(-6); // More messages now
      messages.forEach(msg => {
        const prefix = msg.role === 'user' ? 'USER: ' : 'AEGIS: ';
        doc.setTextColor(msg.role === 'user' ? [167, 139, 250] : [248, 249, 250]);
        const lines = doc.splitTextToSize(`${prefix}${msg.content}`, 180);
        y = checkPageOverflow(y, lines.length * 4);
        doc.text(lines, 14, y);
        y += lines.length * 4 + 1.5;
      });
    }
  } catch (e) { console.warn('Chat history PDF error:', e); }

  // Footer
  doc.setDrawColor(...PURPLE);
  doc.setLineWidth(0.2);
  doc.line(14, 285, 196, 285);
  doc.setTextColor(...TEXT_MUTED);
  doc.setFontSize(6);
  doc.text('GENERATED BY LAPGUARD AI — SECURE DIAGNOSTIC SYSTEM', 14, 290);
  doc.text(new Date().toLocaleString(), 196, 290, { align: 'right' });

  // Save
  const fileName = `lapguard_report_${Date.now()}.pdf`;
  doc.save(fileName);
  return fileName;
};

