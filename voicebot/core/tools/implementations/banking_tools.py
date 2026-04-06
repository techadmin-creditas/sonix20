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
            "CRITICAL: Do NOT guess or hallucinate the account number or date of birth. "
            "If the customer has not explicitly provided BOTH, you MUST ask them for the missing details before calling this tool."
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
                "dob": {
                    "type": "string",
                    "description": "Date of birth in DD-MM-YYYY format",
                },
                "phone_last_4": {
                    "type": "string",
                    "description": "Last 4 digits of the registered phone number",
                },
            },
            "required": ["account_number", "dob", "phone_last_4"],
        }

    @property
    def safety_instructions(self) -> str:
        return (
            "CRITICAL: Do NOT guess, hallucinate, or use placeholders (like '1122', '1234', 'DD-MM-YYYY', '5555') "
            "for verify_customer parameters. If you have not been given a real account number, "
            "birth date, or phone digits by the user, you MUST ask them for the missing details before calling this tool."
        )

    async def execute(self, account_number: str = "", dob: str = "", phone_last_4: str = "", **kwargs) -> str:
        import re
        
        account_number = str(account_number).strip()
        dob_clean = str(dob).strip()
        phone_last_4 = str(phone_last_4).strip()

        # Simple schema validation (non-hardcoded)
        if not re.match(r'^\d{2}[-/]\d{2}[-/]\d{4}$|^\d{4}[-/]\d{2}[-/]\d{2}$', dob_clean):
            result = (
                f"TOOL_ERROR: The DOB '{dob_clean}' is in an invalid format. "
                "You MUST ask the customer for their birth date in DD-MM-YYYY format (e.g., 15-08-1990)."
            )
            await self.log_call({"account_number": account_number, "dob": "***", "phone_last_4": "***"}, result)
            return result

        if len(phone_last_4) != 4 or not phone_last_4.isdigit():
            result = (
                f"TOOL_ERROR: The phone input '{phone_last_4}' is not 4 digits. "
                "Ask the customer specifically for the last 4 digits of their registered mobile number."
            )
            await self.log_call({"account_number": account_number, "dob": "***", "phone_last_4": "***"}, result)
            return result

        if not self.db:
            result = "Banking verification is not available right now. Please try again later."
            await self.log_call({"account_number": account_number, "dob": "***", "phone_last_4": "***"}, result)
            return result

        customer = await self.db.verify_customer(account_number, dob_clean, phone_last_4)

        if customer:
            user_id = customer["id"]
            name = customer["customer_name"]
            acct_type = customer.get("account_type", "savings")
            
            # Update session with the verified user_id for context in subsequent turns
            if self.session:
                self.session.user_id = str(user_id)
                # Also store name for convenience
                if not self.session.metadata:
                    self.session.metadata = {}
                self.session.metadata["verified_name"] = name

            result = (
                f"Identity verified for user_id: {user_id}. Welcome, {name}. "
                f"Your {acct_type} account ending in {account_number[-4:]} is active."
            )
        else:
            result = (
                "I could not verify your identity with the details provided. "
                "The account number, date of birth, or phone digits do not match our records."
            )

        await self.log_call({"account_number": account_number, "dob": "***", "phone_last_4": "***"}, result)
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
            "Only call this after the customer's identity has been verified with verify_customer. "
            "CRITICAL: Do NOT guess or hallucinate the account number. If unknown, ask the user."
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
            "EMI amount, and next due date. Only call after identity has been verified. "
            "CRITICAL: Do NOT guess or hallucinate the account number. If unknown, ask the user."
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
