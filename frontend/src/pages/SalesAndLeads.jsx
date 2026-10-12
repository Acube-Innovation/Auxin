import React, { useState, useEffect } from "react";
import styles from "./SalesAndLeads.module.css"; //
import Side from "./sidebar/Sidebar";
import ClientsTable from "../components/sales-and-leads/ClientsTable";
import SalesLeadsDualGraph from "../components/sales-and-leads/SalesLeadsDualGraph";
import MobileBottomNavigation from "../components/MobileBottomNavigation";
import chevrondown from "../assets/dashboard/chevron-down.svg";
import chevrondright from "../assets/dashboard/chevron-right.svg";
import ProfileAvatar from "../components/ProfileAvatar";
import arrowupright from "../assets/dashboard/arrow-up-right.svg";
import arrowdownup from "../assets/dashboard/arrow-down-up.svg";
import NotificationBell from "../components/NotificationBell";
import clientService from "../services/ClientService";

function SalesAndLeads() {
  const [username, setUsername] = useState("");
  const [userRole, setUserRole] = useState("");
  const [salesMetrics, setSalesMetrics] = useState({
    totalSalesAndLeads: 0,
    totalWon: 0,
    totalOpportunityValue: 0,
    monthlyGrowth: 0
  });
  const [clients, setClients] = useState([]);
  const [isLoadingMetrics, setIsLoadingMetrics] = useState(true);

  useEffect(() => {
    setUsername(localStorage.getItem("username") || "");
    setUserRole(localStorage.getItem("role") || "");
    calculateSalesMetrics();
  }, []);

  const calculateSalesMetrics = async () => {
    setIsLoadingMetrics(true);
    try {
      const clientsData = await clientService.getClients();
      const clientsArray = Array.isArray(clientsData) ? clientsData : (clientsData.clients || []);
      setClients(clientsArray);

      console.log('=== SALES METRICS DEBUG ===');
      console.log('Clients data:', clientsArray);

      // Total Sales and Leads (both Client and Lead types)
      const totalSalesAndLeads = clientsArray.length;
      console.log('Total Sales and Leads:', totalSalesAndLeads);

      // Total Won (currentStatus === 'Won')
      const totalWon = clientsArray.filter(c => c.currentStatus === 'Won').length;
      console.log('Total Won:', totalWon);

      // Total Opportunity Value (sum of opportunityValue for all clients/leads)
      const totalOpportunityValue = clientsArray.reduce((sum, c) => {
        const value = parseFloat(c.opportunityValue) || 0;
        return sum + value;
      }, 0);
      console.log('Total Opportunity Value:', totalOpportunityValue);

      // Monthly growth (clients/leads added this month vs last month)
      const thisMonth = new Date();
      thisMonth.setDate(1); // First day of current month
      const lastMonth = new Date(thisMonth);
      lastMonth.setMonth(lastMonth.getMonth() - 1);

      const thisMonthCount = clientsArray.filter(c => {
        if (!c.createdAt) return false;
        const createdDate = new Date(c.createdAt);
        return createdDate >= thisMonth;
      }).length;

      const lastMonthCount = clientsArray.filter(c => {
        if (!c.createdAt) return false;
        const createdDate = new Date(c.createdAt);
        return createdDate >= lastMonth && createdDate < thisMonth;
      }).length;

      const monthlyGrowth = lastMonthCount > 0
        ? (((thisMonthCount - lastMonthCount) / lastMonthCount) * 100).toFixed(1)
        : (thisMonthCount > 0 ? 100 : 0);

      // Won-specific: count of Won status this month vs last month (for Total Won card)
      const thisMonthWon = clientsArray.filter(c => {
        if (c.currentStatus !== 'Won' || !c.createdAt) return false;
        const d = new Date(c.createdAt);
        return d >= thisMonth;
      }).length;
      const lastMonthWon = clientsArray.filter(c => {
        if (c.currentStatus !== 'Won' || !c.createdAt) return false;
        const d = new Date(c.createdAt);
        return d >= lastMonth && d < thisMonth;
      }).length;
      const wonMonthlyGrowth = lastMonthWon > 0
        ? (((thisMonthWon - lastMonthWon) / lastMonthWon) * 100).toFixed(1)
        : (thisMonthWon > 0 ? 100 : 0);

      setSalesMetrics({
        totalSalesAndLeads,
        totalWon,
        totalOpportunityValue,
        monthlyGrowth: parseFloat(monthlyGrowth),
        wonMonthlyGrowth: parseFloat(wonMonthlyGrowth)
      });
    } catch (error) {
      console.error('Error calculating sales metrics:', error);
    } finally {
      setIsLoadingMetrics(false);
    }
  };

  return (
    <div className={styles["dashboard-layout"]}>
      <div className={styles["desktop-sidebar"]}>
        <Side />
      </div>

      <main>
        <header className={styles["dashboard-header"]}>
          <div className={styles["dashboard-row"]}>
            <div className={styles["dashboard-title"]}>Sales & Leads</div>

            <div className={styles["dashboard-profile"]}>
              <NotificationBell />

              <div className={styles["profile-info"]}>
                <div className={styles["profile-row"]}>
                  <ProfileAvatar size={40} className={styles["profile-picture"]} />
                  <div className={styles["profile-column"]}>
                    <div className={styles["profile-name"]}>
                      {username?.toUpperCase()}
                    </div>
                    <div className={styles["profile-type"]}>
                      {userRole?.toUpperCase()}
                    </div>
                  </div>
                </div>
                {/* <img src={chevrondown} alt="" /> */}
              </div>
            </div>
          </div>
        </header>

        {/* breadcrumb */}
        <section className={styles["breadcrumb-section"]}>
          <div className={styles["breadcrumb"]}>
            <div className={styles["breadcrumb-one"]}>Home</div>
            <img src={chevrondright} alt="" />
            <div className={styles["breadcrumb-two"]}>Sales and Leads</div>
          </div>
        </section>


        <section className={styles.cardcontainer}>
          {/* Card 1 - Total Sales & Leads */}
          <div className={styles.cardbox}>
            <div className={styles.cardboxcontent}>
              <div className={styles.cardheader}>
                <h4>Total Sales & Leads</h4>
                {/* <div className={styles.iconlink}>
                  <img src={arrowupright} alt="arrowup" />
                </div> */}
              </div>
              <h2>{isLoadingMetrics ? '--' : salesMetrics.totalSalesAndLeads}</h2>
              <p className={styles.cardsuccess}>
                {isLoadingMetrics ? '--' : `${salesMetrics.monthlyGrowth >= 0 ? '+' : ''}${salesMetrics.monthlyGrowth}%`} <span>from last month</span>
              </p>
            </div>
          </div>

          {/* Card 2 - Total Won */}
          <div className={styles.cardbox}>
            <div className={styles.cardboxcontent}>
              <div className={styles.cardheader}>
                <h4>Total Won</h4>
                {/* <div className={styles.iconlink}>
                  <img src={arrowupright} alt="arrowup" />
                </div> */}
              </div>
              <h2>{isLoadingMetrics ? '--' : salesMetrics.totalWon}</h2>
              <p className={styles.cardfail}>
                {isLoadingMetrics ? '--' : `${salesMetrics.wonMonthlyGrowth >= 0 ? '+' : ''}${salesMetrics.wonMonthlyGrowth}%`} <span>from last month</span>
              </p>
            </div>
          </div>

          {/* Card 3 - Total Opportunity Value */}
          <div className={`${styles.cardbox} ${styles.large}`}>
            <div className={styles.cardboxcontent}>
              <div className={styles.cardheader}>
                <div className={styles.cardname}>Total Opportunity Value</div>
                {/* <div className={styles.iconlink}>
                  <img src={arrowupright} alt="arrowup" />
                </div> */}
              </div>
              <div className={styles.cardamount}>
                <div className={styles.cardamountvalue}>&#8377;{isLoadingMetrics ? '--' : salesMetrics.totalOpportunityValue.toLocaleString('en-IN')}</div>
                <div className={styles.cardneutral}>&#8599; {isLoadingMetrics ? '--' : `${salesMetrics.monthlyGrowth >= 0 ? '+' : ''}${salesMetrics.monthlyGrowth}%`}</div>
              </div>

              <div className={styles.barchart}>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="33"
                  height="104"
                  viewBox="0 0 33 104"
                  fill="none"
                >
                  <path
                    d="M0 8.89974C0 4.21782 3.79545 0.422363 8.47737 0.422363H23.5226C28.2046 0.422363 32 4.21781 32 8.89973V103.422H0V8.89974Z"
                    fill="#FFF4E6"
                  />
                  <path
                    d="M32 33.8997C32 29.2178 28.2046 25.4224 23.5226 25.4224L8.47737 25.4224C3.79545 25.4224 5.39333e-06 29.2178 4.98784e-06 33.8997L-6.00329e-07 98.4224L32 98.4224L32 33.8997Z"
                    fill="#FFCE8A"
                  />
                  <path
                    d="M0 49.8997C0 45.2178 3.79545 41.4224 8.47737 41.4224H23.7254C28.4074 41.4224 32.2028 45.2178 32.2028 49.8997V103.144H0V49.8997Z"
                    fill="#FFAA33"
                  />
                </svg>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="33"
                  height="95"
                  viewBox="0 0 33 95"
                  fill="none"
                >
                  <path
                    d="M1 8.89974C1 4.21781 4.79545 0.422363 9.47737 0.422363H24.5226C29.2046 0.422363 33 4.21781 33 8.89973V94.4224H1V8.89974Z"
                    fill="#FFF4E6"
                  />
                  <path
                    d="M33 29.8997C33 25.2178 29.2046 21.4224 24.5226 21.4224L9.47737 21.4224C4.79545 21.4224 1.00001 25.2178 1 29.8997L1 89.4224L33 89.4224L33 29.8997Z"
                    fill="#FFCE8A"
                  />
                  <path
                    d="M0.621094 46.8997C0.621094 42.2178 4.41654 38.4224 9.09846 38.4224H24.3465C29.0284 38.4224 32.8239 42.2178 32.8239 46.8997V94.2405H0.621094V46.8997Z"
                    fill="#FFAA33"
                  />
                </svg>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="34"
                  height="87"
                  viewBox="0 0 34 87"
                  fill="none"
                >
                  <path
                    d="M1 8.89974C1 4.21782 4.79545 0.422363 9.47737 0.422363H24.5226C29.2046 0.422363 33 4.21781 33 8.89973V86.4224H1V8.89974Z"
                    fill="#FFF4E6"
                  />
                  <path
                    d="M32.8 31.8997C32.8 27.2178 29.0046 23.4224 24.3227 23.4224L9.27742 23.4224C4.5955 23.4224 0.800054 27.2178 0.800054 31.8997L0.80005 81.4224L32.8 81.4224L32.8 31.8997Z"
                    fill="#FFCE8A"
                  />
                  <path
                    d="M0.821045 68.8997C0.821045 64.2178 4.61649 60.4224 9.29841 60.4224H24.5465C29.2284 60.4224 33.0238 64.2178 33.0238 68.8997V86.7213H0.821045V68.8997Z"
                    fill="#FFAA33"
                  />
                </svg>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="34"
                  height="92"
                  viewBox="0 0 34 92"
                  fill="none"
                >
                  <path
                    d="M1 8.89974C1 4.21782 4.79545 0.422363 9.47737 0.422363H24.5226C29.2046 0.422363 33 4.21781 33 8.89973V91.4224H1V8.89974Z"
                    fill="#FFF4E6"
                  />
                  <path
                    d="M33.4 28.8997C33.4 24.2178 29.6046 20.4224 24.9227 20.4224L8.8774 20.4224C4.19548 20.4224 0.400028 24.2178 0.400027 28.8997L0.400023 86.4224L33.4 86.4224L33.4 28.8997Z"
                    fill="#FFCE8A"
                  />
                  <path
                    d="M1 66.8997C1 62.2178 4.79545 58.4224 9.47737 58.4224H24.7254C29.4074 58.4224 33.2028 62.2178 33.2028 66.8997V91.1619H1V66.8997Z"
                    fill="#FFAA33"
                  />
                </svg>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="34"
                  height="87"
                  viewBox="0 0 34 87"
                  fill="none"
                >
                  <path
                    d="M1 8.89974C1 4.21782 4.79545 0.422363 9.47737 0.422363H24.5226C29.2046 0.422363 33 4.21781 33 8.89973V86.4224H1V8.89974Z"
                    fill="#FFF4E6"
                  />
                  <path
                    d="M32.8 31.8997C32.8 27.2178 29.0046 23.4224 24.3227 23.4224L9.27742 23.4224C4.5955 23.4224 0.800054 27.2178 0.800054 31.8997L0.80005 81.4224L32.8 81.4224L32.8 31.8997Z"
                    fill="#FFCE8A"
                  />
                  <path
                    d="M0.821045 68.8997C0.821045 64.2178 4.61649 60.4224 9.29841 60.4224H24.5465C29.2284 60.4224 33.0238 64.2178 33.0238 68.8997V86.7213H0.821045V68.8997Z"
                    fill="#FFAA33"
                  />
                </svg>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="34"
                  height="87"
                  viewBox="0 0 34 87"
                  fill="none"
                >
                  <path
                    d="M1 8.89974C1 4.21782 4.79545 0.422363 9.47737 0.422363H24.5226C29.2046 0.422363 33 4.21781 33 8.89973V86.4224H1V8.89974Z"
                    fill="#FFF4E6"
                  />
                  <path
                    d="M32.8 31.8997C32.8 27.2178 29.0046 23.4224 24.3227 23.4224L9.27742 23.4224C4.5955 23.4224 0.800054 27.2178 0.800054 31.8997L0.80005 81.4224L32.8 81.4224L32.8 31.8997Z"
                    fill="#FFCE8A"
                  />
                  <path
                    d="M0.821045 68.8997C0.821045 64.2178 4.61649 60.4224 9.29841 60.4224H24.5465C29.2284 60.4224 33.0238 64.2178 33.0238 68.8997V86.7213H0.821045V68.8997Z"
                    fill="#FFAA33"
                  />
                </svg>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="33"
                  height="100"
                  viewBox="0 0 33 100"
                  fill="none"
                >
                  <path
                    d="M0 8.89973C0 4.21781 3.79545 0.422363 8.47737 0.422363H23.5226C28.2046 0.422363 32 4.21781 32 8.89973V99.4224H0V8.89973Z"
                    fill="#FFF4E6"
                  />
                  <path
                    d="M33 32.8997C33 28.2178 29.2046 24.4224 24.5226 24.4224L9.47737 24.4224C4.79545 24.4224 1.00001 28.2178 1 32.8997L1 95.4224L33 95.4224L33 32.8997Z"
                    fill="#FFCE8A"
                  />
                  <path
                    d="M0.178955 75.8997C0.178955 71.2178 3.9744 67.4224 8.65632 67.4224H23.9044C28.5863 67.4224 32.3818 71.2178 32.3818 75.8997V99.0884H0.178955V75.8997Z"
                    fill="#FFAA33"
                  />
                </svg>
              </div>
            </div>
          </div>
        </section>

        {/* Sales & Leads Graph */}
        {/* <section className={styles["graph-section"]} style={{ marginBottom: '24px' }}>
          <SalesLeadsDualGraph clients={clients} isLoading={isLoadingMetrics} />
        </section> */}

        {/* Main Content */}
        <section className={styles["main-content"]}>
          <ClientsTable />
        </section>
      </main>
      {/* Mobile Bottom Navigation */}
      <MobileBottomNavigation />
    </div>
  );
}

export default SalesAndLeads;
