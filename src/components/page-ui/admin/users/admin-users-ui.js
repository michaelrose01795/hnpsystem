// file location: src/components/page-ui/admin/users/admin-users-ui.js

export default function AdminUserManagementUi(props) {
  const {
    AdminUserForm,
    InlineLoading,
    SectionCard,
    SkeletonBlock,
    SkeletonKeyframes,
    SkeletonTableRow,
    StatusTag,
    activeUser,
    companyLoading,
    companyMessage,
    companyProfile,
    companySaving,
    dangerButtonStyle,
    dbError,
    dbLoading,
    dbUsers,
    departmentList,
    directoryError,
    directoryLoading,
    fetchDbUsers,
    handleCompanyInputChange,
    handleCompanySave,
    handleProfileView,
    handleUserCreated,
    handleUserDelete,
    modalCloseButtonStyle,
    modalContentStyle,
    modalOverlayStyle,
    previewMember,
    primaryActionButtonStyle,
    refreshButtonStyle,
    roleList,
    rosterLoading,
    secondaryButtonStyle,
    setActiveUser,
    setShowAddForm,
    setShowModal,
    showAddForm,
    showModal,
    userCount,
  } = props; // receive page logic props.

  switch (props.view) { // choose the page section requested by logic.
    case "section1":
      return <>
      <div style={{
    padding: "24px",
    display: "flex",
    flexDirection: "column",
    gap: "16px"
  }}>
        <header>
          <p style={{
        color: "var(--info)",
        marginTop: "6px"
      }}>
            Provision platform accounts and review department ownership. These records are driven by the shared Supabase roster for consistent testing.
          </p>
        </header>

        <SectionCard title="Company & Bank Details" subtitle="Invoice headers and payment instructions shared across all invoice screens." action={<button type="button" onClick={handleCompanySave} disabled={companySaving} style={{
      padding: "var(--control-padding)",
      borderRadius: "var(--radius-sm)",
      border: "none",
      background: "var(--primary-selected)",
      color: "#fff",
      fontWeight: 600,
      cursor: companySaving ? "not-allowed" : "pointer",
      opacity: companySaving ? 0.6 : 1
    }}>
              {companySaving ? "Saving…" : "Save Details"}
            </button>}>
          {companyMessage && <div style={{
        padding: "var(--control-padding)",
        borderRadius: "var(--radius-sm)",
        marginBottom: "12px",
        background: companyMessage.includes("saved") ? "rgba(var(--success-rgb), 0.15)" : "rgba(var(--danger-rgb), 0.12)",
        color: companyMessage.includes("saved") ? "var(--success-text)" : "var(--danger-dark)",
        fontWeight: 600
      }}>
              {companyMessage}
            </div>}
          {companyLoading ? <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
        gap: "12px"
      }} role="status" aria-live="polite" aria-label="Loading company profile">
              <SkeletonKeyframes />
              {Array.from({
          length: 6
        }).map((_, i) => <SkeletonBlock key={i} width="100%" height="38px" borderRadius="var(--control-radius,10px)" />)}
            </div> : <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
        gap: "12px"
      }}>
              <input value={companyProfile.company_name} onChange={event => handleCompanyInputChange("company_name", event.target.value)} placeholder="Company name" className="app-input" />
              <input value={companyProfile.address_line1} onChange={event => handleCompanyInputChange("address_line1", event.target.value)} placeholder="Address line 1" className="app-input" />
              <input value={companyProfile.address_line2} onChange={event => handleCompanyInputChange("address_line2", event.target.value)} placeholder="Address line 2" className="app-input" />
              <input value={companyProfile.city} onChange={event => handleCompanyInputChange("city", event.target.value)} placeholder="City" className="app-input" />
              <input value={companyProfile.postcode} onChange={event => handleCompanyInputChange("postcode", event.target.value)} placeholder="Postcode" className="app-input" />
              <input value={companyProfile.phone_service} onChange={event => handleCompanyInputChange("phone_service", event.target.value)} placeholder="Service phone" className="app-input" />
              <input value={companyProfile.phone_parts} onChange={event => handleCompanyInputChange("phone_parts", event.target.value)} placeholder="Parts phone" className="app-input" />
              <input value={companyProfile.website} onChange={event => handleCompanyInputChange("website", event.target.value)} placeholder="Website" className="app-input" />
              <input value={companyProfile.bank_name} onChange={event => handleCompanyInputChange("bank_name", event.target.value)} placeholder="Bank name" className="app-input" />
              <input value={companyProfile.sort_code} onChange={event => handleCompanyInputChange("sort_code", event.target.value)} placeholder="Sort code" className="app-input" />
              <input value={companyProfile.account_number} onChange={event => handleCompanyInputChange("account_number", event.target.value)} placeholder="Account number" className="app-input" />
              <input value={companyProfile.account_name} onChange={event => handleCompanyInputChange("account_name", event.target.value)} placeholder="Account name" className="app-input" />
              <textarea value={companyProfile.payment_reference_hint} onChange={event => handleCompanyInputChange("payment_reference_hint", event.target.value)} placeholder="Payment reference hint" rows={3} style={{
          padding: "var(--input-padding)",
          borderRadius: "var(--input-radius)",
          border: "var(--input-border)",
          gridColumn: "1 / -1"
        }} />
            </div>}
        </SectionCard>

        {showAddForm && <AdminUserForm onCreated={handleUserCreated} />}

        <SectionCard title="Live Platform Users" subtitle={dbLoading ? <InlineLoading width={160} label="Loading user roster" /> : "Manage accounts stored in Supabase"} action={<div style={{
      display: "flex",
      gap: "8px"
    }}>
              <button type="button" onClick={() => setShowAddForm(prev => !prev)} style={primaryActionButtonStyle}>
                {showAddForm ? "Close Form" : "Add User"}
              </button>
              <button type="button" onClick={fetchDbUsers} style={refreshButtonStyle}>
                Refresh
              </button>
            </div>}>
          {dbError && <div style={{
        color: "var(--danger)",
        marginBottom: "12px",
        fontWeight: 600
      }}>{dbError}</div>}
          {dbLoading ? <div style={{
        color: "var(--info)"
      }}>Reading users…</div> : <div style={{
        overflowX: "auto"
      }}>
              <p style={{
          color: "var(--info-dark)",
          margin: "0 0 12px"
        }}>
                This table reflects the live <code>users</code> table in Supabase. Any additions or deletions
                performed here instantly update the database and associated activity logs.
              </p>
              <table style={{
          width: "100%",
          borderCollapse: "collapse"
        }}>
                <thead>
                  <tr style={{
              color: "var(--info)",
              fontSize: "0.8rem"
            }}>
                    <th style={{
                textAlign: "left",
                paddingBottom: "10px"
              }}>Name</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Phone</th>
                    <th>Created</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {dbUsers.map(account => <tr key={account.id} style={{
              borderTop: "1px solid var(--theme)"
            }}>
                      <td style={{
                padding: "12px 0",
                fontWeight: 600
              }}>
                        {account.firstName} {account.lastName}
                      </td>
                      <td>{account.email}</td>
                      <td>{account.role}</td>
                      <td>{account.phone || "—"}</td>
                      <td>{new Date(account.createdAt).toLocaleDateString()}</td>
                      <td>
                        <button type="button" onClick={() => handleUserDelete(account.id, `${account.firstName} ${account.lastName}`.trim())} style={dangerButtonStyle}>
                          Remove
                        </button>
                      </td>
                    </tr>)}
                  {dbUsers.length === 0 && <tr>
                      <td colSpan={6} style={{
                padding: "14px",
                textAlign: "center",
                color: "var(--info)"
              }}>
                        No platform users available.
                      </td>
                    </tr>}
                </tbody>
              </table>
            </div>}
        </SectionCard>

        <SectionCard title="User Directory Snapshot" subtitle="Live roster pulled from Supabase users & HR employee profiles" action={<StatusTag label={`${userCount} people`} tone="default" />}>
          {directoryError && <div style={{
        color: "var(--danger)",
        marginBottom: "12px",
        fontWeight: 600
      }}>
              {directoryError}
            </div>}
          {directoryLoading ? <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
        gap: "20px"
      }} role="status" aria-live="polite" aria-label="Loading employee directory">
              <SkeletonKeyframes />
              {Array.from({
          length: 4
        }).map((_, deptIdx) => <div key={deptIdx} style={{
          display: "flex",
          flexDirection: "column",
          gap: "10px"
        }}>
                  <SkeletonBlock width="60%" height="16px" />
                  <div style={{
            display: "flex",
            flexDirection: "column",
            gap: "8px",
            paddingLeft: "18px"
          }}>
                    {Array.from({
              length: 4
            }).map((_, nameIdx) => <SkeletonBlock key={nameIdx} width={nameIdx % 2 === 0 ? "80%" : "66%"} height="12px" />)}
                  </div>
                </div>)}
            </div> : <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
        gap: "20px"
      }}>
              {departmentList.map(({
          department,
          names
        }) => <div key={department} style={{
          display: "flex",
          flexDirection: "column",
          gap: "10px"
        }}>
                  <h3 style={{
            margin: 0,
            fontSize: "1rem",
            fontWeight: 700,
            color: "var(--accent-purple)"
          }}>{department}</h3>
                  <ul style={{
            margin: 0,
            paddingLeft: "18px",
            color: "var(--info-dark)"
          }}>
                    {names.map(name => <li key={`${department}-${name}`}>{name}</li>)}
                  </ul>
                </div>)}
              {departmentList.length === 0 && <div style={{
          color: "var(--info)"
        }}>No departments available.</div>}
            </div>}
        </SectionCard>

        <SectionCard title="Roles & Members" subtitle="Cross-reference roles with associated team members">
          {rosterLoading ? <div style={{
        overflowX: "auto"
      }} role="status" aria-live="polite" aria-label="Loading roster">
              <SkeletonKeyframes />
              <table style={{
          width: "100%",
          borderCollapse: "collapse"
        }}>
                <thead>
                  <tr style={{
              color: "var(--info)",
              fontSize: "0.8rem"
            }}>
                    <th style={{
                textAlign: "left",
                paddingBottom: "10px"
              }}>Role</th>
                    <th style={{
                textAlign: "left",
                paddingBottom: "10px"
              }}>Members</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from({
              length: 6
            }).map((_, i) => <SkeletonTableRow key={i} cols={2} />)}
                </tbody>
              </table>
            </div> : <div style={{
        overflowX: "auto"
      }}>
              <table style={{
          width: "100%",
          borderCollapse: "collapse"
        }}>
                <thead>
                  <tr style={{
              color: "var(--info)",
              fontSize: "0.8rem"
            }}>
                    <th style={{
                textAlign: "left",
                paddingBottom: "10px"
              }}>Role</th>
                    <th>Members</th>
                  </tr>
                </thead>
                <tbody>
                  {roleList.map(({
              role,
              members
            }) => <tr key={role} style={{
              borderTop: "1px solid var(--theme)"
            }}>
                      <td style={{
                padding: "12px 0",
                fontWeight: 600
              }}>{role}</td>
                      <td>
                        {members.length > 0 ? <div style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "8px"
                }}>
                            {members.map(member => <button key={`${role}-${member.id || member.displayName}`} type="button" onClick={() => handleProfileView(member)} style={{
                    padding: "6px 10px",
                    borderRadius: "var(--radius-pill)",
                    border: "1px solid var(--theme)",
                    background: activeUser === member.displayName ? "var(--accent-purple)" : "white",
                    color: activeUser === member.displayName ? "white" : "var(--info-dark)",
                    fontSize: "0.85rem",
                    fontWeight: 600,
                    cursor: "pointer",
                    transition: "all 0.15s ease"
                  }}>
                                {member.displayName}
                              </button>)}
                          </div> : <span style={{
                  color: "var(--info)"
                }}>No members assigned</span>}
                      </td>
                    </tr>)}
                </tbody>
              </table>
            </div>}
        </SectionCard>

        {showModal && previewMember && <div style={modalOverlayStyle}>
            <div style={modalContentStyle}>
              <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "12px"
        }}>
                <h3 style={{
            margin: 0,
            fontSize: "1.1rem",
            fontWeight: 700
          }}>
                  {previewMember.displayName} &mdash; Profile Preview
                </h3>
                <button type="button" onClick={() => {
            setShowModal(false);
            setActiveUser(null);
          }} style={modalCloseButtonStyle}>
                  ✕
                </button>
              </div>
              <iframe title={`${previewMember.displayName} profile`} src={`/admin/profiles/${encodeURIComponent(previewMember.key || previewMember.displayName)}`} style={{
          width: "100%",
          height: "500px",
          border: "1px solid var(--theme)",
          borderRadius: "var(--radius-sm)"
        }} />
              <div style={{
          display: "flex",
          gap: "10px",
          marginTop: "12px"
        }}>
                <button type="button" style={secondaryButtonStyle} disabled>
                  Edit profile (coming soon)
                </button>
                <button type="button" style={secondaryButtonStyle} disabled>
                  Manage documents
                </button>
              </div>
            </div>
          </div>}
      </div>
    </>; // render extracted page section.
    default:
      return null; // keep unknown sections visually empty.
  }
}
