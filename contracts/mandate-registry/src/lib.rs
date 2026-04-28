#![no_std]

use soroban_sdk::{
    contract, contracterror, contractevent, contractimpl, contracttype, Address, BytesN, Env,
};

#[contract]
pub struct MandateRegistry;

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct MandateConfig {
    pub user: Address,
    pub agent: Address,
    pub merchant: Address,
    pub token: Address,
    pub per_tx_limit: i128,
    pub period_limit: i128,
    pub period_ledger_count: u32,
    pub expires_at_ledger: u32,
    pub intent_hash: BytesN<32>,
    pub revoked: bool,
}

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Mandate(BytesN<32>),
    PeriodSpend(BytesN<32>, u32),
    Nonce(BytesN<32>, BytesN<32>),
}

#[contracterror]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum RegistryError {
    AlreadyRegistered = 1,
    NotFound = 2,
    Revoked = 3,
    Expired = 4,
    InvalidAmount = 5,
    PerTxLimitExceeded = 6,
    PeriodLimitExceeded = 7,
    MerchantMismatch = 8,
    TokenMismatch = 9,
    Replay = 10,
    InvalidPeriod = 11,
}

#[contractevent]
pub struct MandateRegistered {
    #[topic]
    pub mandate_id: BytesN<32>,
    pub user: Address,
    pub agent: Address,
    pub intent_hash: BytesN<32>,
}

#[contractevent]
pub struct MandateSpendConsumed {
    #[topic]
    pub mandate_id: BytesN<32>,
    pub agent: Address,
    pub merchant: Address,
    pub token: Address,
    pub amount: i128,
    pub period_spend: i128,
}

#[contractevent]
pub struct MandateRevoked {
    #[topic]
    pub mandate_id: BytesN<32>,
    pub user: Address,
}

#[contractimpl]
impl MandateRegistry {
    pub fn register_mandate(
        env: Env,
        mandate_id: BytesN<32>,
        config: MandateConfig,
    ) -> Result<BytesN<32>, RegistryError> {
        config.user.require_auth();

        if config.period_ledger_count == 0 {
            return Err(RegistryError::InvalidPeriod);
        }

        if config.per_tx_limit <= 0 || config.period_limit <= 0 {
            return Err(RegistryError::InvalidAmount);
        }

        let key = DataKey::Mandate(mandate_id.clone());

        if env.storage().persistent().has(&key) {
            return Err(RegistryError::AlreadyRegistered);
        }

        env.storage().persistent().set(&key, &config);
        MandateRegistered {
            mandate_id: mandate_id.clone(),
            user: config.user,
            agent: config.agent,
            intent_hash: config.intent_hash,
        }
        .publish(&env);

        Ok(mandate_id)
    }

    pub fn validate_and_consume(
        env: Env,
        mandate_id: BytesN<32>,
        nonce: BytesN<32>,
        amount: i128,
        merchant: Address,
        token: Address,
    ) -> Result<bool, RegistryError> {
        let key = DataKey::Mandate(mandate_id.clone());
        let config: MandateConfig = env
            .storage()
            .persistent()
            .get(&key)
            .ok_or(RegistryError::NotFound)?;

        config.agent.require_auth();

        if config.revoked {
            return Err(RegistryError::Revoked);
        }

        if env.ledger().sequence() > config.expires_at_ledger {
            return Err(RegistryError::Expired);
        }

        if amount <= 0 {
            return Err(RegistryError::InvalidAmount);
        }

        if amount > config.per_tx_limit {
            return Err(RegistryError::PerTxLimitExceeded);
        }

        if merchant != config.merchant {
            return Err(RegistryError::MerchantMismatch);
        }

        if token != config.token {
            return Err(RegistryError::TokenMismatch);
        }

        let nonce_key = DataKey::Nonce(mandate_id.clone(), nonce.clone());
        if env.storage().temporary().has(&nonce_key) {
            return Err(RegistryError::Replay);
        }

        let period = env.ledger().sequence() / config.period_ledger_count;
        let spend_key = DataKey::PeriodSpend(mandate_id.clone(), period);
        let current_spend: i128 = env.storage().temporary().get(&spend_key).unwrap_or(0);
        let next_spend = current_spend + amount;

        if next_spend > config.period_limit {
            return Err(RegistryError::PeriodLimitExceeded);
        }

        env.storage().temporary().set(&spend_key, &next_spend);
        env.storage().temporary().set(&nonce_key, &true);
        MandateSpendConsumed {
            mandate_id,
            agent: config.agent,
            merchant,
            token,
            amount,
            period_spend: next_spend,
        }
        .publish(&env);

        Ok(true)
    }

    pub fn revoke_mandate(env: Env, mandate_id: BytesN<32>) -> Result<bool, RegistryError> {
        let key = DataKey::Mandate(mandate_id.clone());
        let mut config: MandateConfig = env
            .storage()
            .persistent()
            .get(&key)
            .ok_or(RegistryError::NotFound)?;

        config.user.require_auth();
        config.revoked = true;

        env.storage().persistent().set(&key, &config);
        MandateRevoked {
            mandate_id,
            user: config.user,
        }
        .publish(&env);

        Ok(true)
    }

    pub fn get_mandate(env: Env, mandate_id: BytesN<32>) -> Result<MandateConfig, RegistryError> {
        env.storage()
            .persistent()
            .get(&DataKey::Mandate(mandate_id))
            .ok_or(RegistryError::NotFound)
    }

    pub fn remaining_budget(env: Env, mandate_id: BytesN<32>) -> Result<i128, RegistryError> {
        let config: MandateConfig = env
            .storage()
            .persistent()
            .get(&DataKey::Mandate(mandate_id.clone()))
            .ok_or(RegistryError::NotFound)?;

        let period = env.ledger().sequence() / config.period_ledger_count;
        let spend_key = DataKey::PeriodSpend(mandate_id, period);
        let current_spend: i128 = env.storage().temporary().get(&spend_key).unwrap_or(0);

        Ok(config.period_limit - current_spend)
    }

    pub fn is_nonce_consumed(env: Env, mandate_id: BytesN<32>, nonce: BytesN<32>) -> bool {
        env.storage()
            .temporary()
            .has(&DataKey::Nonce(mandate_id, nonce))
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::{
        testutils::{Address as _, Ledger},
        Env,
    };

    fn bytes(env: &Env, value: u8) -> BytesN<32> {
        BytesN::from_array(env, &[value; 32])
    }

    fn setup() -> (
        Env,
        MandateRegistryClient<'static>,
        BytesN<32>,
        MandateConfig,
    ) {
        let env = Env::default();
        env.mock_all_auths();
        env.ledger().set_sequence_number(100);

        let contract_id = env.register(MandateRegistry, ());
        let client = MandateRegistryClient::new(&env, &contract_id);

        let mandate_id = bytes(&env, 1);
        let config = MandateConfig {
            user: Address::generate(&env),
            agent: Address::generate(&env),
            merchant: Address::generate(&env),
            token: Address::generate(&env),
            per_tx_limit: 600,
            period_limit: 1000,
            period_ledger_count: 100,
            expires_at_ledger: 500,
            intent_hash: bytes(&env, 9),
            revoked: false,
        };

        (env, client, mandate_id, config)
    }

    #[test]
    fn registers_and_consumes_budget() {
        let (env, client, mandate_id, config) = setup();

        assert_eq!(client.register_mandate(&mandate_id, &config), mandate_id);
        assert_eq!(client.remaining_budget(&mandate_id), 1000);

        assert!(client.validate_and_consume(
            &mandate_id,
            &bytes(&env, 2),
            &250,
            &config.merchant,
            &config.token
        ));

        assert_eq!(client.remaining_budget(&mandate_id), 750);
    }

    #[test]
    fn rejects_replayed_nonce() {
        let (env, client, mandate_id, config) = setup();
        let nonce = bytes(&env, 3);

        client.register_mandate(&mandate_id, &config);
        client.validate_and_consume(&mandate_id, &nonce, &100, &config.merchant, &config.token);

        assert_eq!(
            client.try_validate_and_consume(
                &mandate_id,
                &nonce,
                &100,
                &config.merchant,
                &config.token
            ),
            Err(Ok(RegistryError::Replay))
        );
    }

    #[test]
    fn rejects_limit_and_scope_violations() {
        let (env, client, mandate_id, config) = setup();
        let wrong_merchant = Address::generate(&env);
        let wrong_token = Address::generate(&env);

        client.register_mandate(&mandate_id, &config);

        assert_eq!(
            client.try_validate_and_consume(
                &mandate_id,
                &bytes(&env, 4),
                &601,
                &config.merchant,
                &config.token
            ),
            Err(Ok(RegistryError::PerTxLimitExceeded))
        );

        assert_eq!(
            client.try_validate_and_consume(
                &mandate_id,
                &bytes(&env, 5),
                &100,
                &wrong_merchant,
                &config.token
            ),
            Err(Ok(RegistryError::MerchantMismatch))
        );

        assert_eq!(
            client.try_validate_and_consume(
                &mandate_id,
                &bytes(&env, 6),
                &100,
                &config.merchant,
                &wrong_token
            ),
            Err(Ok(RegistryError::TokenMismatch))
        );
    }

    #[test]
    fn rejects_period_budget_overrun() {
        let (env, client, mandate_id, config) = setup();

        client.register_mandate(&mandate_id, &config);
        client.validate_and_consume(
            &mandate_id,
            &bytes(&env, 7),
            &600,
            &config.merchant,
            &config.token,
        );

        assert_eq!(
            client.try_validate_and_consume(
                &mandate_id,
                &bytes(&env, 8),
                &401,
                &config.merchant,
                &config.token
            ),
            Err(Ok(RegistryError::PeriodLimitExceeded))
        );
    }

    #[test]
    fn rejects_revoked_and_expired_mandates() {
        let (env, client, mandate_id, config) = setup();

        client.register_mandate(&mandate_id, &config);
        client.revoke_mandate(&mandate_id);

        assert_eq!(
            client.try_validate_and_consume(
                &mandate_id,
                &bytes(&env, 10),
                &100,
                &config.merchant,
                &config.token
            ),
            Err(Ok(RegistryError::Revoked))
        );

        let expired_id = bytes(&env, 11);
        let mut expired = config.clone();
        expired.revoked = false;
        expired.expires_at_ledger = 101;
        client.register_mandate(&expired_id, &expired);
        env.ledger().set_sequence_number(102);

        assert_eq!(
            client.try_validate_and_consume(
                &expired_id,
                &bytes(&env, 12),
                &100,
                &expired.merchant,
                &expired.token
            ),
            Err(Ok(RegistryError::Expired))
        );
    }
}
