"""Banking tools — real SQLite lookups for customer verification, balance, and loans."""

from typing import Any, Dict, Optional
from voicebot.core.tools.base import BaseTool


class VerifyCustomerTool(BaseTool):
    """Verify a bank customer's identity by account number and date of birth."""

    @property
    def name(self) -> str:
        return "verify_customer"

    @property
    def description(self) -> str:
        return (
            "Verify a bank customer's identity using their account number and date of birth. "
            "Always call this tool before sharing any account information such as balance or loans. "
            "Ask the customer for their account number and date of birth in DD-MM-YYYY format."
        )

    @property
    def parameters(self) -> Dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "account_number": {
                    "type": "string",
                    "description": "The customer's bank account number (e.g. ACC1001)",
                },
                "dob": {
                    "type": "string",
                    "description": "Date of birth in DD-MM-YYYY format (e.g. 15-03-1990)",
                },
            },
            "required": ["account_number", "dob"],
        }

    async def execute(self, account_number: str = "", dob: str = "", **kwargs) -> str:
        if not self.db:
            result = "Banking verification is not available right now. Please try again later."
            await self.log_call({"account_number": account_number, "dob": "***"}, result)
            return result

        customer = await self.db.verify_customer(account_number, dob)

        if customer:
            name = customer["customer_name"]
            acct_type = customer.get("account_type", "savings")
            # Store the verified name as a user fact for cross-session memory
            if self.session and self.session.user_id:
                try:
                    await self.db.save_user_fact(
                        fact=f"Verified customer name: {name}, Account: {account_number.upper()}",
                        category="identity",
                        session_id=self.session.session_id,
                        user_id=self.session.user_id,
                    )
                except Exception:
                    pass
            result = (
                f"Identity verified. Welcome, {name}. "
                f"Your {acct_type} account ending in {account_number[-4:]} is active."
            )
        else:
            result = (
                "I could not verify your identity with the details provided. "
                "Please double-check your account number and date of birth and try again."
            )

        await self.log_call({"account_number": account_number, "dob": "***"}, result)
        return result


class GetAccountBalanceTool(BaseTool):
    """Get the current account balance for a verified customer."""

    @property
    def name(self) -> str:
        return "get_account_balance"

    @property
    def description(self) -> str:
        return (
            "Get the current account balance for a bank customer. "
            "Only call this after the customer's identity has been verified with verify_customer."
        )

    @property
    def parameters(self) -> Dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "account_number": {
                    "type": "string",
                    "description": "The customer's bank account number",
                },
            },
            "required": ["account_number"],
        }

    async def execute(self, account_number: str = "", **kwargs) -> str:
        if not self.db:
            result = "Account balance lookup is not available right now."
            await self.log_call({"account_number": account_number}, result)
            return result

        data = await self.db.get_account_balance(account_number)

        if data:
            balance = data["balance"]
            acct_type = data.get("account_type", "savings")
            # Format with Indian numbering style for voice clarity
            result = (
                f"Your current {acct_type} account balance is "
                f"rupees {balance:,.2f}."
            )
        else:
            result = (
                "I could not find an account with that number. "
                "Please verify the account number and try again."
            )

        await self.log_call({"account_number": account_number}, result)
        return result


class GetLoanStatusTool(BaseTool):
    """Get active loan details for a customer including EMI and next due date."""

    @property
    def name(self) -> str:
        return "get_loan_status"

    @property
    def description(self) -> str:
        return (
            "Get active loan details for a bank customer including outstanding amount, "
            "EMI amount, and next due date. Only call after identity has been verified."
        )

    @property
    def parameters(self) -> Dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "account_number": {
                    "type": "string",
                    "description": "The customer's bank account number",
                },
            },
            "required": ["account_number"],
        }

    async def execute(self, account_number: str = "", **kwargs) -> str:
        if not self.db:
            result = "Loan status lookup is not available right now."
            await self.log_call({"account_number": account_number}, result)
            return result

        loans = await self.db.get_loan_details(account_number)

        if not loans:
            result = "There are no active loans found on this account."
        else:
            parts = []
            for loan in loans:
                loan_type = loan["loan_type"].replace("_", " ").title()
                outstanding = loan["outstanding"]
                emi = loan["emi_amount"]
                next_due = loan["next_due"]
                status = loan.get("status", "active")
                status_note = " This EMI is overdue." if status == "overdue" else ""
                parts.append(
                    f"You have a {loan_type} loan with rupees {outstanding:,.0f} outstanding. "
                    f"Your EMI of rupees {emi:,.0f} is due on {next_due}.{status_note}"
                )
            result = " ".join(parts)

        await self.log_call({"account_number": account_number}, result)
        return result
