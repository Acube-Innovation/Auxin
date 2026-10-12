import React, { useState } from 'react';
import styles from './SalarySlipBulkImportModal.module.css';
import { FaTimes, FaDownload, FaFileExcel, FaFileCsv, FaUpload, FaCheck, FaExclamationCircle, FaArrowRight, FaArrowLeft, FaTable, FaInfoCircle, FaSpinner } from 'react-icons/fa';
import * as XLSX from 'xlsx';
import salarySlipService from '../../services/SalarySlipService';

const STEPS = [
    { id: 1, name: 'Upload', icon: FaUpload },
    { id: 2, name: 'Review', icon: FaTable },
    { id: 3, name: 'Import', icon: FaCheck },
];

const SALARY_FIELDS = [
    { key: 'employeeName', label: 'Employee Name', required: true },
    { key: 'emailId', label: 'Email ID', required: true },
    { key: 'designation', label: 'Designation', required: true },
    { key: 'dateOfJoining', label: 'Date of Joining', required: false },
    // Earnings
    { key: 'basicPay', label: 'Earnings.Basic Pay (₹)', required: true },
    { key: 'hra', label: 'Earnings.HRA (₹)', required: true },
    { key: 'conveyanceAllowance', label: 'Earnings.Convy. Allowance (₹)', required: false },
    { key: 'otherAllowance', label: 'Earnings.Other Allowance (₹)', required: false },
    // Deductions
    { key: 'advance', label: 'Deductions.Advance (₹)', required: false },
    { key: 'leave', label: 'Deduction.Leave (₹)', required: false },
    { key: 'staffLoan', label: 'Deduction.Staff Loan (₹)', required: false },
    { key: 'profTax', label: 'Deduction.Prof. Tax (₹)', required: false },
    { key: 'incomeTaxTDS', label: 'Deduction.TDS (₹)', required: false },
    // Legacy (for backward compat)
    { key: 'deductionsPFTax', label: 'Deductions (PF/Tax)', required: false },
    { key: 'netSalary', label: 'Net Salary (₹)', required: false },
];

function SalarySlipBulkImportModal({ isOpen, onClose, onSuccess, month, year }) {
    const [currentStep, setCurrentStep] = useState(1);
    const [isLoading, setIsLoading] = useState(false);
    const [uploadedFile, setUploadedFile] = useState(null);
    const [parsedData, setParsedData] = useState([]);
    const [columnMapping, setColumnMapping] = useState({});
    const [errors, setErrors] = useState([]);
    const [successCount, setSuccessCount] = useState(0);

    if (!isOpen) return null;

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setUploadedFile(file);
        setIsLoading(true);
        setErrors([]);
        try {
            const data = await parseFile(file);
            if (data.length > 0) {
                const headers = Object.keys(data[0]);
                setParsedData(data);

                // Auto-map headers with maximum flexibility (Alpha-numeric only matching)
                const mapping = {};
                SALARY_FIELDS.forEach(field => {
                    const fieldPossible = [
                        field.label.toLowerCase().replace(/[^a-z0-9]/g, ''),
                        field.key.toLowerCase().replace(/[^a-z0-9]/g, '')
                    ];

                    if (field.key === 'emailId') fieldPossible.push('email', 'emailid', 'mail');
                    if (field.key === 'deductionsPFTax') fieldPossible.push('deduction', 'pf', 'tax', 'pfytax');
                    if (field.key === 'dateOfJoining') fieldPossible.push('joining', 'dateofjoining', 'joiningdate', 'doj');
                    if (field.key === 'conveyanceAllowance') fieldPossible.push('conveyance', 'convy', 'convyallowance', 'conveyanceallowance');
                    if (field.key === 'otherAllowance') fieldPossible.push('otherallowance', 'other');
                    if (field.key === 'advance') fieldPossible.push('advance');
                    if (field.key === 'leave') fieldPossible.push('leave');
                    if (field.key === 'staffLoan') fieldPossible.push('staffloan', 'staff');
                    if (field.key === 'profTax') fieldPossible.push('proftax', 'professionaltax', 'proftax');
                    if (field.key === 'incomeTaxTDS') fieldPossible.push('tds', 'incometax', 'incometaxtds');

                    const match = headers.find(h => {
                        const cleanH = h.toLowerCase().replace(/[^a-z0-9]/g, '');
                        return fieldPossible.some(pk => cleanH === pk || cleanH.includes(pk));
                    });

                    if (match) mapping[field.key] = match;
                });
                setColumnMapping(mapping);
                setCurrentStep(2);
            } else {
                setErrors(['No data found in file']);
            }
        } catch (error) {
            setErrors([`Failed to parse file: ${error.message}`]);
        } finally {
            setIsLoading(false);
        }
    };

    const parseFile = (file) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
                    // Treat all cells as strings to avoid numeric parsing issues for mapping
                    const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: '', raw: false });
                    resolve(jsonData);
                } catch (error) {
                    reject(error);
                }
            };
            reader.readAsArrayBuffer(file);
        });
    };

    const downloadTemplate = (format) => {
        const headers = SALARY_FIELDS.map(f => f.label);
        const sampleData = [
            ['John Doe', 'john.doe@example.com', 'Software Engineer', '2023-05-15', '50000', '15000', '2000', '1000', '3000', '500', '2000', '200', '1000', '5000', '65700'],
            ['Jane Smith', 'jane.smith@example.com', 'Product Manager', '2024-01-10', '60000', '18000', '2500', '1500', '4000', '1000', '3000', '200', '1500', '6200', '75800']
        ];

        const worksheet = XLSX.utils.aoa_to_sheet([headers, ...sampleData]);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Template");

        const filename = `salary_slip_template_${month}_${year}.${format}`;
        XLSX.writeFile(workbook, filename);
    };

    const handleImport = async () => {
        if (!uploadedFile) {
            setErrors(['File access error. Please upload the file again.']);
            return;
        }

        setIsLoading(true);
        setErrors([]);

        try {
            const res = await salarySlipService.importSalarySlips(uploadedFile, month, year);
            setSuccessCount(res.count || parsedData.length);
            setCurrentStep(3);
        } catch (error) {
            setErrors([error.message || 'Import failed']);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className={styles.modalOverlay}>
            <div className={styles.modalContent}>
                <div className={styles.modalHeader}>
                    <h2>Bulk Import Salary Slips ({month} {year})</h2>
                    <button onClick={onClose} className={styles.closeBtn}><FaTimes /></button>
                </div>

                <div className={styles.stepper}>
                    {STEPS.map((step, idx) => (
                        <React.Fragment key={step.id}>
                            <div className={`${styles.step} ${currentStep >= step.id ? styles.active : ''}`}>
                                <div className={styles.stepIcon}>
                                    {currentStep > step.id ? <FaCheck /> : <step.icon />}
                                </div>
                                <span>{step.name}</span>
                            </div>
                            {idx < STEPS.length - 1 && <div className={`${styles.stepLine} ${currentStep > step.id ? styles.active : ''}`} />}
                        </React.Fragment>
                    ))}
                </div>

                <div className={styles.stepContent}>
                    {currentStep === 1 && (
                        <div className={styles.uploadStep}>
                            <div className={styles.templateSection}>
                                <h3>1. Download Template</h3>
                                <div className={styles.templateBtns}>
                                    <button onClick={() => downloadTemplate('xlsx')}><FaFileExcel /> Excel Template</button>
                                    <button onClick={() => downloadTemplate('csv')}><FaFileCsv /> CSV Template</button>
                                </div>
                            </div>
                            <div className={styles.uploadSection}>
                                <h3>2. Upload Filled File</h3>
                                <input id="bulk-upload-input" type="file" className={styles.hiddenInput} accept=".xlsx,.xls,.csv" onChange={handleFileUpload} />
                                <label htmlFor="bulk-upload-input" className={styles.dropzone}>
                                    <FaUpload className={styles.uploadIcon} />
                                    <p>Click to browse or drag and drop</p>
                                    <span>Supported formats: .xlsx, .xls, .csv</span>
                                </label>
                            </div>
                        </div>
                    )}

                    {currentStep === 2 && (
                        <div className={styles.reviewStep}>
                            <div className={styles.infoBar}>
                                <FaInfoCircle />
                                <span>Found {parsedData.length} records. Please verify the mapping below.</span>
                            </div>
                            <div className={styles.tableWrapper}>
                                <table className={styles.previewTable}>
                                    <thead>
                                        <tr>
                                            {SALARY_FIELDS.map(f => (
                                                <th key={f.key}>{f.label}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {parsedData.slice(0, 5).map((row, i) => (
                                            <tr key={i}>
                                                {SALARY_FIELDS.map(f => (
                                                    <td key={f.key}>{row[columnMapping[f.key]] || '-'}</td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                {parsedData.length > 5 && <div className={styles.tableNote}>+ {parsedData.length - 5} more records</div>}
                            </div>
                            {errors.length > 0 && (
                                <div className={styles.errorSection}>
                                    {errors.map((err, i) => <div key={i} className={styles.errorMessage}><FaExclamationCircle /> {err}</div>)}
                                </div>
                            )}
                        </div>
                    )}

                    {currentStep === 3 && (
                        <div className={styles.successStep}>
                            <div className={styles.successIcon}><FaCheck /></div>
                            <h3>Import Successful!</h3>
                            <p>Successfully processed {successCount} salary slips for {month} {year}.</p>
                            <button onClick={() => { onSuccess(); onClose(); }} className={styles.finishBtn}>Return to List</button>
                        </div>
                    )}
                </div>

                {currentStep < 3 && (
                    <div className={styles.modalFooter}>
                        <button onClick={onClose} disabled={isLoading} className={styles.cancelBtn}>Cancel</button>
                        {currentStep === 2 && (
                            <button onClick={handleImport} disabled={isLoading} className={styles.importBtn}>
                                {isLoading ? <><FaSpinner className={styles.spin} /> Importing...</> : <>Complete Import <FaArrowRight /></>}
                            </button>
                        )}
                        {currentStep === 1 && (
                            <button className={styles.importBtn} disabled style={{ opacity: 0.5 }}>
                                Next Step (Upload a file)
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

export default SalarySlipBulkImportModal;
