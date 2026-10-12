import React, { useState, useEffect } from 'react';
import styles from './SalarySlipManualAddModal.module.css';
import { FaTimes, FaSave, FaSpinner } from 'react-icons/fa';
import salarySlipService from '../../services/SalarySlipService';
import { useToast } from '../../context/ToastContext';

function SalarySlipManualAddModal({ isOpen, onClose, onSuccess, month, year }) {
    const { showToast } = useToast();
    const [isLoading, setIsLoading] = useState(false);
    const [formData, setFormData] = useState({
        employeeName: '',
        email: '',
        designation: '',
        dateOfJoining: '',
        // Earnings
        basicPay: '',
        hra: '',
        conveyanceAllowance: '',
        otherAllowance: '',
        // Deductions
        advance: '',
        leave: '',
        staffLoan: '',
        profTax: '',
        incomeTaxTDS: '',
        // Calculated fields
        grossSalary: '',
        totalDeduction: '',
        netSalary: '',
        month: month,
        year: year
    });

    // Reset form when modal opens
    useEffect(() => {
        if (isOpen) {
            setFormData({
                employeeName: '',
                email: '',
                designation: '',
                dateOfJoining: '',
                basicPay: '',
                hra: '',
                conveyanceAllowance: '',
                otherAllowance: '',
                advance: '',
                leave: '',
                staffLoan: '',
                profTax: '',
                incomeTaxTDS: '',
                grossSalary: '',
                totalDeduction: '',
                netSalary: '',
                month: month,
                year: year
            });
        }
    }, [isOpen, month, year]);

    if (!isOpen) return null;

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => {
            const updated = { ...prev, [name]: value };

            // Convert all values to numbers for calculations
            const basicPay = Number(updated.basicPay) || 0;
            const hra = Number(updated.hra) || 0;
            const conveyanceAllowance = Number(updated.conveyanceAllowance) || 0;
            const otherAllowance = Number(updated.otherAllowance) || 0;

            // Calculate Gross Salary from earnings
            const grossSalary = basicPay + hra + conveyanceAllowance + otherAllowance;
            updated.grossSalary = grossSalary.toFixed(2);

            // Calculate Total Deduction (sum of all deductions)
            const advance = Number(updated.advance) || 0;
            const leave = Number(updated.leave) || 0;
            const staffLoan = Number(updated.staffLoan) || 0;
            const profTax = Number(updated.profTax) || 0;
            const incomeTaxTDS = Number(updated.incomeTaxTDS) || 0;
            const totalDeduction = advance + leave + staffLoan + profTax + incomeTaxTDS;

            // Calculate Net Payable (Gross Salary - Total Deduction)
            const netSalary = grossSalary - totalDeduction;

            updated.totalDeduction = totalDeduction.toFixed(2);
            updated.netSalary = netSalary.toFixed(2);

            return updated;
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        try {
            await salarySlipService.createSalarySlip({
                employeeName: formData.employeeName,
                emailId: formData.email,
                designation: formData.designation,
                dateOfJoining: formData.dateOfJoining,
                // Earnings
                basicPay: parseFloat(formData.basicPay) || 0,
                hra: parseFloat(formData.hra) || 0,
                conveyanceAllowance: parseFloat(formData.conveyanceAllowance) || 0,
                otherAllowance: parseFloat(formData.otherAllowance) || 0,
                grossSalary: parseFloat(formData.grossSalary) || 0,
                // Deductions
                advance: parseFloat(formData.advance) || 0,
                leave: parseFloat(formData.leave) || 0,
                staffLoan: parseFloat(formData.staffLoan) || 0,
                profTax: parseFloat(formData.profTax) || 0,
                incomeTaxTDS: parseFloat(formData.incomeTaxTDS) || 0,
                totalDeduction: parseFloat(formData.totalDeduction) || 0,
                // Legacy field for backward compatibility
                deductionsPFTax: parseFloat(formData.totalDeduction) || 0,
                netSalary: parseFloat(formData.netSalary) || 0,
                month: formData.month,
                year: formData.year
            });
            showToast("Salary slip created successfully.", "success");
            onSuccess();
            onClose();
        } catch (error) {
            showToast(error.message || "Failed to create salary slip.", "error");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className={styles.modalOverlay}>
            <div className={styles.modalContent}>
                <div className={styles.modalHeader}>
                    <h2>Create Salary Slip</h2>
                    <button onClick={onClose} className={styles.closeBtn}><FaTimes /></button>
                </div>

                <form onSubmit={handleSubmit} className={styles.form}>
                    {/* Employee Info Section */}
                    <div className={styles.section}>
                        <h3 className={styles.sectionTitle}>Employee Information</h3>
                        <div className={styles.grid}>
                            <div className={styles.inputGroup}>
                                <label>Employee Name *</label>
                                <input type="text" name="employeeName" value={formData.employeeName} onChange={handleChange} required placeholder="Full Name" />
                            </div>
                            <div className={styles.inputGroup}>
                                <label>Employee Email *</label>
                                <input type="email" name="email" value={formData.email} onChange={handleChange} required placeholder="employee@example.com" />
                            </div>
                            <div className={styles.inputGroup}>
                                <label>Designation *</label>
                                <input type="text" name="designation" value={formData.designation} onChange={handleChange} required placeholder="e.g. Software Engineer" />
                            </div>
                            <div className={styles.inputGroup}>
                                <label>Date of Joining</label>
                                <input type="date" name="dateOfJoining" value={formData.dateOfJoining} onChange={handleChange} />
                            </div>
                            <div className={styles.inputGroup}>
                                <label>Month *</label>
                                <select name="month" value={formData.month} onChange={handleChange} required className={styles.selectInput}>
                                    <option value="">Select Month</option>
                                    <option value="January">January</option>
                                    <option value="February">February</option>
                                    <option value="March">March</option>
                                    <option value="April">April</option>
                                    <option value="May">May</option>
                                    <option value="June">June</option>
                                    <option value="July">July</option>
                                    <option value="August">August</option>
                                    <option value="September">September</option>
                                    <option value="October">October</option>
                                    <option value="November">November</option>
                                    <option value="December">December</option>
                                </select>
                            </div>
                            <div className={styles.inputGroup}>
                                <label>Year *</label>
                                <input type="number" name="year" value={formData.year} onChange={handleChange} required placeholder="e.g. 2025" min="2000" max="2100" />
                            </div>
                        </div>
                    </div>

                    {/* Earnings & Deductions Side by Side */}
                    <div className={styles.twoColumnSection}>
                        {/* Earnings Section */}
                        <div className={styles.column}>
                            <h3 className={styles.sectionTitle}>Earnings</h3>
                            <table className={styles.slipTable}>
                                <thead>
                                    <tr>
                                        <th>Description</th>
                                        <th>Amount (₹)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td>Basic Pay</td>
                                        <td>
                                            <input type="number" name="basicPay" value={formData.basicPay} onChange={handleChange} required placeholder="0.00" step="0.01" min="0" />
                                        </td>
                                    </tr>
                                    <tr>
                                        <td>HRA (House Rent Allowance)</td>
                                        <td>
                                            <input 
                                                type="number" 
                                                name="hra"
                                                value={formData.hra} 
                                                onChange={handleChange}
                                                placeholder="0.00"
                                                step="0.01"
                                                min="0"
                                            />
                                        </td>
                                    </tr>
                                    <tr>
                                        <td>Conveyance Allowance</td>
                                        <td>
                                            <input type="number" name="conveyanceAllowance" value={formData.conveyanceAllowance} onChange={handleChange} placeholder="0.00" step="0.01" min="0" />
                                        </td>
                                    </tr>
                                    <tr>
                                        <td>Other Allowance</td>
                                        <td>
                                            <input 
                                                type="number" 
                                                name="otherAllowance"
                                                value={formData.otherAllowance} 
                                                onChange={handleChange}
                                                placeholder="0.00"
                                                step="0.01"
                                                min="0"
                                            />
                                        </td>
                                    </tr>
                                </tbody>
                                <tfoot>
                                    <tr className={styles.totalRow}>
                                        <td><strong>Gross Salary</strong></td>
                                        <td>
                                            <input 
                                                type="number" 
                                                name="grossSalary" 
                                                value={formData.grossSalary} 
                                                onChange={handleChange} 
                                                placeholder="0.00" 
                                                step="0.01" 
                                                min="0"
                                                title="Enter Gross Salary to auto-calculate Other Allowance"
                                            />
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>

                        {/* Deductions Section */}
                        <div className={styles.column}>
                            <h3 className={styles.sectionTitle}>Deductions</h3>
                            <table className={styles.slipTable}>
                                <thead>
                                    <tr>
                                        <th>Description</th>
                                        <th>Amount (₹)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td>Advance</td>
                                        <td>
                                            <input type="number" name="advance" value={formData.advance} onChange={handleChange} placeholder="0.00" step="0.01" min="0" />
                                        </td>
                                    </tr>
                                    <tr>
                                        <td>Leave</td>
                                        <td>
                                            <input type="number" name="leave" value={formData.leave} onChange={handleChange} placeholder="0.00" step="0.01" min="0" />
                                        </td>
                                    </tr>
                                    <tr>
                                        <td>Staff Loan</td>
                                        <td>
                                            <input type="number" name="staffLoan" value={formData.staffLoan} onChange={handleChange} placeholder="0.00" step="0.01" min="0" />
                                        </td>
                                    </tr>
                                    <tr>
                                        <td>Prof. Tax</td>
                                        <td>
                                            <input type="number" name="profTax" value={formData.profTax} onChange={handleChange} placeholder="0.00" step="0.01" min="0" />
                                        </td>
                                    </tr>
                                    <tr>
                                        <td>Income Tax/TDS</td>
                                        <td>
                                            <input type="number" name="incomeTaxTDS" value={formData.incomeTaxTDS} onChange={handleChange} placeholder="0.00" step="0.01" min="0" />
                                        </td>
                                    </tr>
                                </tbody>
                                <tfoot>
                                    <tr className={styles.totalRow}>
                                        <td><strong>Total Deduction</strong></td>
                                        <td>
                                            <input type="text" value={formData.totalDeduction ? `₹${parseFloat(formData.totalDeduction).toLocaleString('en-IN')}` : '₹0.00'} readOnly className={styles.readOnlyInput} />
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>

                    {/* Net Payable Section */}
                    <div className={styles.netPayableSection}>
                        <div className={styles.netPayableRow}>
                            <span className={styles.netPayableLabel}>Net Payable</span>
                            <span className={styles.netPayableValue}>
                                {formData.netSalary ? `₹${parseFloat(formData.netSalary).toLocaleString('en-IN')}` : '₹0.00'}
                            </span>
                        </div>
                        <p className={styles.netPayableNote}>Net Payable = Gross Salary - Total Deduction</p>
                        <p className={styles.netPayableNote}>
                            <strong>Gross Salary</strong> is auto-calculated as the sum of all earnings.
                        </p>
                    </div>

                    <div className={styles.modalFooter}>
                        <button type="button" onClick={onClose} className={styles.cancelBtn}>Cancel</button>
                        <button type="submit" disabled={isLoading} className={styles.submitBtn}>
                            {isLoading ? <FaSpinner className={styles.spin} /> : <FaSave />}
                            <span>{isLoading ? 'Creating...' : 'Create Slip'}</span>
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default SalarySlipManualAddModal;
